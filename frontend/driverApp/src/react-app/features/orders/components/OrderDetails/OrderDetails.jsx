import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { BackButton } from "@shared/app/components/BackButton/BackButton.jsx";
import { RequestLoader, RequestLoadingState } from "@shared/app/components/RequestLoader/RequestLoader.jsx";
import { useI18n } from "@shared/app/i18n/useI18n.js";
import { useUpdateProfileMutation } from "@shared/features/auth/authApi.js";
import { selectToken, selectUser, setSession } from "@shared/features/auth/authSlice.js";
import { saveSession } from "@shared/features/auth/authStorage.js";
import { hasManagerAccess } from "@shared/features/auth/authAccess.js";
import {
  createEmptyProvider,
  createProviderId,
  getUserProviders,
  hasProviderData,
  hasSameProviderDetails,
  normalizeProvider,
  serializeProviders,
} from "@shared/features/auth/providerProfile.js";
import { useGenerateContractPdfMutation } from "../../../contract/contractApi.js";
import { downloadFile } from "../../../contract/utils/downloadFile.js";
import {
  detectCurrency,
  extractNumericPrice,
  formatPrice,
  sanitizePriceInput,
  setCurrentCurrency,
} from "../../../contract/utils/priceUtils.js";
import { useGetAdminUsersQuery } from "@shared/features/admin/adminApi.js";
import { SvgIcon } from "@shared/app/components/SvgIcon/SvgIcon.jsx";
import {
  useAssignDriverMutation,
  useGetOrderQuery,
  useUpdateOrderMutation,
} from "../../ordersApi.js";
import { formatDateTime, getOrderTripTime } from "../../../../pages/HistoryPage/historyUtils.js";
import { resolveErrorMessage } from "@shared/app/utils/errorMessages.js";
import "./OrderDetails.css";

function getLocation(value) {
  if (!value) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  return value.address || value.name || value.label || "-";
}

function getTransferLabel(user) {
  if (!user) {
    return "-";
  }

  return `${user.name || "-"} · ${user.email || "-"}`;
}

function getProviderMeta(provider, t) {
  return [
    provider?.address,
    provider?.ico ? `${t('auth.ico')}: ${provider.ico}` : '',
    provider?.dic ? `${t('auth.dic')}: ${provider.dic}` : '',
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' · ');
}

function getCommissionValue(order) {
  return String(order?.metadata?.commission ?? order?.contractData?.commission ?? "").trim();
}

function normalizeFlightNumber(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const FLIGHT_STATUS_VALUES = new Set([
  "landed",
  "delayed",
  "in_air",
  "scheduled",
  "cancelled",
  "unknown",
]);

function normalizeFlightStatus(value, fallbackFlightNumber) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const rawStatus = String(value.status || "").trim().toLowerCase();
  const route = value.route && typeof value.route === "object" && !Array.isArray(value.route)
    ? value.route
    : {};

  return {
    status: FLIGHT_STATUS_VALUES.has(rawStatus) ? rawStatus : "unknown",
    flightNumber: normalizeFlightNumber(value.flightNumber || fallbackFlightNumber),
    route: {
      from: String(route.from || "").trim(),
      to: String(route.to || "").trim(),
      fromCode: String(route.fromCode || "").trim().toUpperCase(),
      toCode: String(route.toCode || "").trim().toUpperCase(),
    },
    scheduledArrival: value.scheduledArrival || "",
    estimatedArrival: value.estimatedArrival || "",
    actualArrival: value.actualArrival || "",
    delayMinutes: Math.max(0, Number.parseInt(String(value.delayMinutes || "0"), 10) || 0),
    terminal: String(value.terminal || "").trim(),
    baggageClaim: String(value.baggageClaim || "").trim(),
    updatedAt: value.updatedAt || "",
  };
}

function formatFlightPoint(name, code) {
  const normalizedName = String(name || "").trim();
  const normalizedCode = String(code || "").trim().toUpperCase();

  if (normalizedName && normalizedCode && !normalizedName.toUpperCase().includes(normalizedCode)) {
    return `${normalizedName} (${normalizedCode})`;
  }

  return normalizedName || normalizedCode;
}

function formatFlightRoute(route) {
  return [
    formatFlightPoint(route?.from, route?.fromCode),
    formatFlightPoint(route?.to, route?.toCode),
  ].filter(Boolean).join(" → ");
}

function formatFlightDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");

  return `${day}.${month}.${year}, ${hours}:${minutes}`;
}

function getFlightStatusLabel(flightStatus, t) {
  const labels = {
    landed: "contract.flightStatusLanded",
    delayed: "contract.flightStatusDelayed",
    in_air: "contract.flightStatusInAir",
    scheduled: "contract.flightStatusScheduled",
    cancelled: "contract.flightStatusCancelled",
    unknown: "contract.flightStatusUnknown",
  };
  const label = t(labels[flightStatus?.status] || labels.unknown);

  if (flightStatus?.status === "delayed" && flightStatus.delayMinutes) {
    return `${label} +${flightStatus.delayMinutes} ${t("contract.minutesShort")}`;
  }

  return label;
}

function normalizeCount(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizePhoneHref(value) {
  const source = String(value || "").trim();
  const digits = source.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return `${source.startsWith("+") ? "+" : ""}${digits}`;
}

function normalizeWhatsAppPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function getPhoneContactValue(...values) {
  return values
    .map((value) => String(value || "").trim())
    .find((value) => {
      if (!value || value.includes("@")) {
        return false;
      }

      return value.replace(/\D/g, "").length >= 7;
    }) || "";
}

function getEmailContactValue(...values) {
  return values
    .map((value) => String(value || "").trim())
    .find((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) || "";
}

async function copyTextToClipboard(value) {
  const text = String(value || "").trim();

  if (!text) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

function OrderGlyph({ name }) {
  return <SvgIcon name={name} />;
}

function OrderCardIcon({ name, tone = "neutral", className = "" }) {
  return (
    <span className={`orderSheetIcon orderSheetIcon--${tone} ${className}`.trim()}>
      <OrderGlyph name={name} />
    </span>
  );
}

export function OrderDetails({ orderId, onClose }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const currentUser = useSelector(selectUser);
  const token = useSelector(selectToken);
  const { t } = useI18n();
  const canTransfer = hasManagerAccess(currentUser?.role);
  const [isClosing, setIsClosing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [commissionInput, setCommissionInput] = useState("");
  const [commissionCurrency, setCommissionCurrency] = useState("EUR");
  const [commissionEditorOpen, setCommissionEditorOpen] = useState(false);
  const [priceEditorOpen, setPriceEditorOpen] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("EUR");
  const [flightNumberEditorOpen, setFlightNumberEditorOpen] = useState(false);
  const [flightNumberInput, setFlightNumberInput] = useState("");
  const [contactActionsOpen, setContactActionsOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferSearch, setTransferSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assignDriver, { isLoading: isTransferring }] =
    useAssignDriverMutation();
  const [updateOrder, { isLoading: isUpdatingOrder }] = useUpdateOrderMutation();
  const [updateProfile, { isLoading: isSavingProvider }] = useUpdateProfileMutation();
  const [generateContractPdf, { isLoading: isGenerating }] =
    useGenerateContractPdfMutation();
  const { data, isLoading, isError } = useGetOrderQuery(orderId, {
    skip: !orderId,
  });
  const { data: adminUsersData, isFetching: isUsersFetching } =
    useGetAdminUsersQuery(
      {
        search: transferSearch,
        role: "all",
        status: "all",
        planId: "all",
      },
      {
        skip: !orderId || !showTransfer || !canTransfer,
      },
    );

  const order = data?.order || data || {};
  const orderProvider = order?.contractData?.provider || {};
  const savedProviders = useMemo(() => getUserProviders(currentUser), [currentUser]);
  const isProviderAlreadySaved = savedProviders.some(provider =>
    hasSameProviderDetails(provider, orderProvider),
  );
  const canSaveProvider = hasProviderData(orderProvider) && !isProviderAlreadySaved;
  const providerMeta = getProviderMeta(orderProvider, t);
  const customer = order?.contractData?.customer || order?.customer || {};
  const trip = order?.contractData?.trip || order?.trip || {};
  const customerContact = String(customer.phone || customer.email || customer.contact || "").trim();
  const customerEmail = String(customer.email || "").trim();
  const customerBirthDate = String(customer.birthDate || customer.dateOfBirth || "").trim();
  const customerAddress = String(customer.address || customer.residentialAddress || "").trim();
  const customerPhone = getPhoneContactValue(customer.phone, customer.email, customer.contact);
  const customerEmailContact = getEmailContactValue(customer.email, customer.contact, customer.phone);
  const customerPhoneHref = normalizePhoneHref(customerPhone);
  const customerWhatsAppPhone = normalizeWhatsAppPhone(customerPhone);
  const isCopyableContact = Boolean(customerPhone || customerEmailContact);
  const passengersCount = normalizeCount(order?.contractData?.passengers || order?.passengers);
  const luggageUnits = normalizeCount(
    trip?.luggageUnits ||
      order?.contractData?.luggageUnits ||
      order?.luggageUnits ||
      '',
  );
  const driverComment = String(
    trip?.driverComment ||
      order?.contractData?.driverComment ||
      order?.driverComment ||
      '',
  ).trim();
  const tripTime = formatDateTime(getOrderTripTime(order));
  const storedCommission = getCommissionValue(order);
  const storedPrice = String(order?.totalPrice || order?.contractData?.totalPrice || "").trim();
  const storedFlightNumber = String(
    order?.flightNumber || order?.contractData?.flightNumber || "",
  ).trim();
  const flightStatus = normalizeFlightStatus(order?.metadata?.flightStatus, storedFlightNumber);
  const amountDue = storedPrice || "-";
  const commissionConverted = useMemo(() => {
    if (!commissionInput) {
      return "";
    }

    return formatPrice(commissionInput, commissionCurrency);
  }, [commissionCurrency, commissionInput]);
  const orderOwner = order?.user || {};
  const orderOwnerId = String(orderOwner?.id || order.userId || "");
  const adminUsers = adminUsersData?.users || [];
  const transferUsers = useMemo(() => {
    return adminUsers.filter((user) => user?.role !== "admin");
  }, [adminUsers]);
  const selectedTransferUser = transferUsers.find(
    (user) => user.id === selectedUserId,
  );

  useEffect(() => {
    if (!orderId) {
      return;
    }

    setIsClosing(false);
    setMessage("");
    setError("");
    setShowTransfer(false);
    setTransferSearch("");
    setSelectedUserId("");
    setCommissionEditorOpen(false);
    setPriceEditorOpen(false);
    setFlightNumberEditorOpen(false);
    setContactActionsOpen(false);
    setCopyNotice("");
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      return;
    }

    const currentValue = String(storedCommission || "").trim();
    const nextCurrency = detectCurrency(currentValue);
    const nextInput = extractNumericPrice(currentValue);

    setCommissionCurrency(nextCurrency);
    setCurrentCurrency(nextCurrency);
    setCommissionInput(nextInput);
  }, [orderId, storedCommission]);

  useEffect(() => {
    if (!isClosing) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      onClose();
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isClosing, onClose]);

  useEffect(() => {
    if (!copyNotice) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setCopyNotice("");
    }, 2400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [copyNotice]);

  useEffect(() => {
    if (!orderId) {
      return undefined;
    }

    const body = document.body;
    body.classList.add("no-scroll");

    function handleKeyDown(event) {
      if (
        event.key === "Escape" &&
        !isTransferring &&
        !isGenerating &&
        !isUpdatingOrder
      ) {
        if (commissionEditorOpen) {
          setCommissionEditorOpen(false);
          return;
        }

        if (priceEditorOpen) {
          setPriceEditorOpen(false);
          return;
        }

        if (flightNumberEditorOpen) {
          setFlightNumberEditorOpen(false);
          return;
        }

        if (contactActionsOpen) {
          setContactActionsOpen(false);
          return;
        }

        if (showTransfer) {
          setShowTransfer(false);
          return;
        }

        setIsClosing(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      body.classList.remove("no-scroll");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    orderId,
    showTransfer,
    isTransferring,
    isGenerating,
    isUpdatingOrder,
    commissionEditorOpen,
    priceEditorOpen,
    flightNumberEditorOpen,
    contactActionsOpen,
    onClose,
  ]);

  async function handleDelete() {
    setMessage("");
    setError("");
    navigate(`/orders/${orderId}/dispatch`);
  }

  async function handleDownloadPdf(documentType) {
    setMessage("");
    setError("");

    try {
      const blob = await generateContractPdf({
        orderId,
        documentType,
        contractData: order.contractData || {},
      }).unwrap();

      const safeNumber = String(order.orderNumber || orderId).replace(
        /[^a-z0-9_-]+/gi,
        "-",
      );
      downloadFile(blob, `${safeNumber}-${documentType}.pdf`);
      setMessage(t('contract.pdfDownloaded'));

      try {
        await updateOrder({
          orderId,
          skipInvalidation: true,
          payload: {
            status: "pdf_generated",
            metadata: {
              documentType,
            },
            pdf: {
              documentType,
            },
          },
        }).unwrap();
      } catch (updateError) {
        console.error(
          "Failed to update order status after PDF download:",
          updateError,
        );
      }
    } catch (error) {
      setError(
        resolveErrorMessage(error, t('contract.failedGeneratePdf')),
      );
    }
  }

  function handleOpenDisplay() {
    navigate(`/history/display/${orderId}`);
  }

  async function handleTransfer() {
    setMessage("");
    setError("");

    if (!selectedUserId) {
      setError(t('contract.selectDriverFirst'));
      return;
    }

    try {
      const response = await assignDriver({
        orderId,
        userId: selectedUserId,
      }).unwrap();

      setMessage(
        t('contract.transferredTo', {
          name: response?.order?.user?.name || selectedTransferUser?.name || t('common.unknownUser'),
        }),
      );
      setShowTransfer(false);
      setSelectedUserId("");
    } catch (error) {
      setError(resolveErrorMessage(error, t('contract.failedToTransferOrder')));
    }
  }

  async function handleSaveProviderToProfile() {
    if (!hasProviderData(orderProvider)) {
      return;
    }

    if (isProviderAlreadySaved) {
      setMessage(t('contract.providerAlreadySaved'));
      return;
    }

    const hasIdCollision = savedProviders.some(provider => provider.id && provider.id === orderProvider.id);
    const nextProviderId = hasIdCollision || !orderProvider.id ? createProviderId() : orderProvider.id;
    const nextProvider = normalizeProvider(
      {
        ...orderProvider,
        id: nextProviderId,
      },
      nextProviderId,
    );
    const nextProviders = serializeProviders([...savedProviders, nextProvider]);
    const requestedDefaultProviderId = currentUser?.profile?.defaultProviderId || nextProviders[0]?.id || '';
    const nextDefaultProviderId = nextProviders.some(provider => provider.id === requestedDefaultProviderId)
      ? requestedDefaultProviderId
      : nextProviders[0]?.id || '';
    const defaultProvider =
      nextProviders.find(provider => provider.id === nextDefaultProviderId) ||
      nextProviders[0] ||
      createEmptyProvider();

    setMessage("");
    setError("");

    try {
      const updatedUser = await updateProfile({
        providers: nextProviders,
        defaultProviderId: nextDefaultProviderId,
        provider: defaultProvider,
      }).unwrap();

      saveSession(token, updatedUser);
      dispatch(setSession({ token, user: updatedUser }));
      setMessage(t('contract.providerSavedToProfile'));
    } catch (saveError) {
      setError(resolveErrorMessage(saveError, t('contract.failedToSaveProvider')));
    }
  }

  async function saveCommission(nextValue = commissionInput, nextCurrency = commissionCurrency) {
    const formatted = formatPrice(nextValue, nextCurrency);
    const normalized = formatted || sanitizePriceInput(nextValue);

    if (normalized === storedCommission) {
      setCommissionInput(extractNumericPrice(storedCommission));
      return true;
    }

    setMessage("");
    setError("");

    try {
      await updateOrder({
        orderId,
        payload: {
          metadata: {
            ...(order.metadata || {}),
            commission: normalized,
          },
        },
      }).unwrap();

      setCommissionInput(extractNumericPrice(normalized));
      setMessage(normalized ? t('contract.commissionSaved') : t('contract.commissionCleared'));
      return true;
    } catch (error) {
      setError(resolveErrorMessage(error, t('contract.failedToSaveCommission')));
      setCommissionInput(extractNumericPrice(storedCommission));
      return false;
    }
  }

  async function handleSaveCommission() {
    const saved = await saveCommission();

    if (saved) {
      closeCommissionEditor();
    }
  }

  function handleCommissionInputChange(event) {
    const nextInput = sanitizePriceInput(event.target.value);
    setCommissionInput(nextInput);
  }

  function openCommissionEditor() {
    const currentValue = String(storedCommission || "").trim();
    const nextCurrency = detectCurrency(currentValue);
    const nextInput = extractNumericPrice(currentValue);

    setError("");
    setMessage("");
    setCommissionCurrency(nextCurrency);
    setCurrentCurrency(nextCurrency);
    setCommissionInput(nextInput);
    setCommissionEditorOpen(true);
  }

  function closeCommissionEditor() {
    setCommissionEditorOpen(false);
  }

  function handleCommissionCurrencyChange(nextCurrency) {
    if (nextCurrency === commissionCurrency) {
      return;
    }

    setCurrentCurrency(nextCurrency);
    setCommissionCurrency(nextCurrency);
  }

  function clearCommission() {
    setCommissionInput("");
    setCommissionCurrency("EUR");
    setCurrentCurrency("EUR");
  }

  function openPriceEditor() {
    const currentValue = String(storedPrice || "").trim();
    const nextCurrency = detectCurrency(currentValue);
    const nextInput = extractNumericPrice(currentValue);

    setError("");
    setMessage("");
    setPriceCurrency(nextCurrency);
    setCurrentCurrency(nextCurrency);
    setPriceInput(nextInput);
    setPriceEditorOpen(true);
  }

  function closePriceEditor() {
    setPriceEditorOpen(false);
  }

  function openFlightNumberEditor() {
    setError("");
    setMessage("");
    setFlightNumberInput(normalizeFlightNumber(storedFlightNumber));
    setFlightNumberEditorOpen(true);
  }

  function closeFlightNumberEditor() {
    setFlightNumberEditorOpen(false);
  }

  function openContactActions() {
    if (!customerPhoneHref) {
      return;
    }

    setError("");
    setMessage("");
    setContactActionsOpen(true);
  }

  function closeContactActions() {
    setContactActionsOpen(false);
  }

  function handleEmailContact() {
    if (!customerEmailContact) {
      return;
    }

    window.location.href = `mailto:${customerEmailContact}`;
  }

  async function handleCopyContact() {
    if (!customerContact) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const copied = await copyTextToClipboard(customerContact);

      if (!copied) {
        throw new Error("Clipboard unavailable");
      }

      setCopyNotice(t('contract.contactCopied'));
    } catch {
      setError(t('contract.failedToCopyContact'));
    }
  }

  function handleFlightNumberInputChange(event) {
    setFlightNumberInput(normalizeFlightNumber(event.target.value));
  }

  async function saveFlightNumber() {
    const normalized = normalizeFlightNumber(flightNumberInput);

    if (normalized === storedFlightNumber) {
      closeFlightNumberEditor();
      return;
    }

    setMessage("");
    setError("");

    try {
      await updateOrder({
        orderId,
        payload: {
          flightNumber: normalized,
          contractData: {
            ...(order.contractData || {}),
            flightNumber: normalized,
          },
        },
      }).unwrap();

      closeFlightNumberEditor();
      setMessage(t('contract.flightNumberUpdated'));
    } catch (updateError) {
      setError(resolveErrorMessage(updateError, t('contract.failedToUpdateFlightNumber')));
    }
  }

  function handlePriceInputChange(event) {
    setPriceInput(sanitizePriceInput(event.target.value));
  }

  function handlePriceCurrencyChange(nextCurrency) {
    if (nextCurrency === priceCurrency) {
      return;
    }

    setCurrentCurrency(nextCurrency);
    setPriceCurrency(nextCurrency);
  }

  async function savePrice() {
    const formatted = formatPrice(priceInput, priceCurrency);
    const normalized = formatted || sanitizePriceInput(priceInput);

    if (!normalized) {
      setError(t('contract.failedToUpdatePrice'));
      return;
    }

    if (normalized === storedPrice) {
      closePriceEditor();
      return;
    }

    setMessage("");
    setError("");

    try {
      await updateOrder({
        orderId,
        payload: {
          totalPrice: normalized,
          contractData: {
            ...(order.contractData || {}),
            totalPrice: normalized,
          },
        },
      }).unwrap();

      closePriceEditor();
      setMessage(t('contract.priceUpdated'));
    } catch (updateError) {
      setError(resolveErrorMessage(updateError, t('contract.failedToUpdatePrice')));
    }
  }

  function handleCloseRequest() {
    if (commissionEditorOpen) {
      setCommissionEditorOpen(false);
      return;
    }

    if (priceEditorOpen) {
      setPriceEditorOpen(false);
      return;
    }

    if (flightNumberEditorOpen) {
      setFlightNumberEditorOpen(false);
      return;
    }

    if (contactActionsOpen) {
      setContactActionsOpen(false);
      return;
    }

    if (showTransfer) {
      setShowTransfer(false);
      return;
    }

    setIsClosing(true);
  }

  async function handleSaveAndClose() {
    const saved = await saveCommission();

    if (saved) {
      handleCloseRequest();
    }
  }

  function handleBackdropClick(event) {
    if (event.target !== event.currentTarget) {
      return;
    }

    handleCloseRequest();
  }

  if (!orderId) {
    return null;
  }

  return (
    <section
      className={`orderDrawer ${isClosing ? "is-closing" : "is-open"}`}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div
        className="orderDrawer-backdrop"
        aria-hidden="true"
        onClick={handleBackdropClick}
      />
      <div
        className="orderDrawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('contract.currentOrder')}
      >
        {copyNotice ? (
          <div className="orderContactToast" role="status" aria-live="polite">
            <SvgIcon name="copy" />
            <span>{copyNotice}</span>
          </div>
        ) : null}

        <div className="orderDrawer-header">
          <BackButton label={t('common.back')} onClick={handleCloseRequest} />
        </div>

        {message ? <p className="orderWindow-message">{message}</p> : null}
        {error ? <p className="orderWindow-error">{error}</p> : null}

        {isLoading ? (
          <RequestLoadingState className="orderWindow-state" label={t('manager.loadingOrder')} />
        ) : null}
        {isError ? (
          <p className="orderWindow-state">{t('contract.failedLoadOrder')}</p>
        ) : null}

        {!isLoading && !isError ? (
          <>
            <section className="orderSheetCard">
              <div className="orderSheetRows">
                <div className="orderSheetInfoRow orderSheetInfoRow--primaryId">
                  <div className="orderSheetInfoLead">
                    <OrderCardIcon name="file" tone="accent" />
                    <span className="orderSheetInfoLabel">{t('contract.orderId')}</span>
                  </div>
                  <span className="orderSheetInfoValue">{order.orderNumber || "-"}</span>
                </div>

                <div className="orderSheetInfoRow orderSheetInfoRow--customer">
                  <div className="orderSheetInfoLead">
                    <OrderCardIcon name="user" />
                    <span className="orderSheetInfoLabel">{t('contract.customer')}</span>
                  </div>
                  <div className="orderSheetValueAction">
                    <span className="orderSheetInfoValue">{customer.name || "-"}</span>
                    <button
                      className="orderSheetDisplayButton"
                      type="button"
                      onClick={handleOpenDisplay}
                      aria-label={`${t('history.openDisplay')} ${customer.name || t('common.noName')}`}
                      title={t('history.openDisplay')}
                    >
                      <SvgIcon name="monitor" />
                    </button>
                  </div>
                </div>

                <div className="orderSheetInfoRow">
                  <div className="orderSheetInfoLead">
                    <OrderCardIcon name="mail" />
                    <span className="orderSheetInfoLabel">{t('contract.customerData')}</span>
                  </div>
                  <div className="orderSheetContactValue">
                    {isCopyableContact ? (
                      <button
                        className="orderSheetContactTextButton"
                        type="button"
                        onClick={() => void handleCopyContact()}
                        aria-label={t('contract.copyContact')}
                        title={t('contract.copyContact')}
                      >
                        {customerContact}
                      </button>
                    ) : (
                      <span className="orderSheetInfoValue">{customerContact || customerEmail || "-"}</span>
                    )}

                    {customerPhoneHref ? (
                      <button
                        className="orderSheetContactButton"
                        type="button"
                        onClick={openContactActions}
                        aria-label={t('contract.openContactActions')}
                        title={t('contract.openContactActions')}
                      >
                        <OrderGlyph name="phone-call" />
                      </button>
                    ) : customerEmailContact ? (
                      <button
                        className="orderSheetContactButton orderSheetContactButton--email"
                        type="button"
                        onClick={handleEmailContact}
                        aria-label={t('contract.emailContact')}
                        title={t('contract.emailContact')}
                      >
                        <OrderGlyph name="mail" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {customerBirthDate ? (
                  <div className="orderSheetInfoRow">
                    <div className="orderSheetInfoLead">
                      <OrderCardIcon name="user" />
                      <span className="orderSheetInfoLabel">{t('contract.customerBirthDate')}</span>
                    </div>
                    <span className="orderSheetInfoValue">{customerBirthDate}</span>
                  </div>
                ) : null}

                {customerAddress ? (
                  <div className="orderSheetInfoRow orderSheetInfoRow--customerAddress">
                    <div className="orderSheetInfoLead orderSheetInfoLead--alignStart">
                      <OrderCardIcon name="location" />
                      <span className="orderSheetInfoLabel">{t('contract.customerAddress')}</span>
                    </div>
                    <span className="orderSheetInfoValue orderSheetInfoValue--customerAddress">
                      {customerAddress}
                    </span>
                  </div>
                ) : null}

                <div
                  className="orderSheetInfoRow orderSheetInfoRow--compactStats"
                  aria-label={`${t('contract.passengers')}: ${passengersCount}. ${t('contract.luggageUnits')}: ${luggageUnits}. ${t('contract.flightNumber')}: ${storedFlightNumber || "-"}.`}
                >
                  <div className="orderSheetCompactGroup">
                    <span className="orderSheetCompactStat">
                      <OrderCardIcon name="accounts" />
                      <span className="orderSheetCompactStatValue">{passengersCount}</span>
                    </span>
                    <span className="orderSheetCompactStat">
                      <OrderCardIcon name="luggage" />
                      <span className="orderSheetCompactStatValue">{luggageUnits}</span>
                    </span>
                  </div>
                  <div className="orderSheetFlightStat">
                    <OrderCardIcon name="takeoff" />
                    <span className="orderSheetCompactStatValue">{storedFlightNumber || "-"}</span>
                    <button
                      className="orderSheetEditButton"
                      type="button"
                      onClick={openFlightNumberEditor}
                      aria-label={t('contract.editFlightNumber')}
                    >
                      <OrderGlyph name="edit" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="orderSheetCard">
              <div className="orderSheetSectionHeader">
                <OrderCardIcon name="location" tone="accent" />
                <h4 className="orderSheetSectionTitle">{t('contract.tripInfo')}</h4>
              </div>

              <div className="orderSheetRouteRows">
                <div className="orderSheetRouteTimeline" aria-hidden="true">
                  <span className="orderSheetRouteDot orderSheetRouteDot--from" />
                  <span className="orderSheetRouteLine" />
                  <span className="orderSheetRouteDot orderSheetRouteDot--to" />
                </div>

                <div className="orderSheetRouteContent">
                  <div className="orderSheetRouteRow">
                    <span className="orderSheetInfoLabel">{t('contract.from')}</span>
                    <span className="orderSheetInfoValue">{getLocation(trip.from)}</span>
                  </div>
                  <div className="orderSheetRouteRow">
                    <span className="orderSheetInfoLabel">{t('contract.to')}</span>
                    <span className="orderSheetInfoValue">{getLocation(trip.to)}</span>
                  </div>
                </div>
              </div>

              <div className="orderSheetRows orderSheetRows--afterRoute">
                <div className="orderSheetInfoRow">
                  <div className="orderSheetInfoLead">
                    <OrderCardIcon name="clock" />
                    <span className="orderSheetInfoLabel">{t('contract.tripTime')}</span>
                  </div>
                  <span className="orderSheetInfoValue">{tripTime}</span>
                </div>

                {driverComment ? (
                  <div className="orderSheetInfoRow orderSheetInfoRow--driverComment">
                    <div className="orderSheetInfoLead orderSheetInfoLead--alignStart">
                      <OrderCardIcon name="file" />
                      <span className="orderSheetInfoLabel">{t('contract.driverComment')}</span>
                    </div>
                    <span className="orderSheetInfoValue orderSheetInfoValue--driverComment">
                      {driverComment}
                    </span>
                  </div>
                ) : null}
              </div>
            </section>

            {flightStatus ? (
              <section className="orderSheetCard orderSheetFlightCard">
                <div className="orderSheetSectionHeader">
                  <OrderCardIcon name="takeoff" tone="accent" />
                  <h4 className="orderSheetSectionTitle">{t('contract.flightInfo')}</h4>
                </div>

                <div className="orderSheetFlightHero">
                  <div className="orderSheetFlightIdentity">
                    <strong>{flightStatus.flightNumber || storedFlightNumber || '-'}</strong>
                    {formatFlightRoute(flightStatus.route) ? (
                      <span>{formatFlightRoute(flightStatus.route)}</span>
                    ) : null}
                  </div>
                  <span className={`orderSheetFlightBadge orderSheetFlightBadge--${flightStatus.status}`}>
                    <span aria-hidden="true" />
                    {getFlightStatusLabel(flightStatus, t)}
                  </span>
                </div>

                <div className="orderSheetRows orderSheetFlightRows">
                  {flightStatus.scheduledArrival ? (
                    <div className="orderSheetInfoRow">
                      <span className="orderSheetInfoLabel">{t('contract.scheduledArrival')}</span>
                      <span className="orderSheetInfoValue">{formatFlightDateTime(flightStatus.scheduledArrival)}</span>
                    </div>
                  ) : null}
                  {flightStatus.estimatedArrival ? (
                    <div className="orderSheetInfoRow">
                      <span className="orderSheetInfoLabel">{t('contract.estimatedArrival')}</span>
                      <span className="orderSheetInfoValue orderSheetFlightValue--accent">
                        {formatFlightDateTime(flightStatus.estimatedArrival)}
                      </span>
                    </div>
                  ) : null}
                  {flightStatus.actualArrival ? (
                    <div className="orderSheetInfoRow">
                      <span className="orderSheetInfoLabel">{t('contract.actualArrival')}</span>
                      <span className="orderSheetInfoValue orderSheetFlightValue--success">
                        {formatFlightDateTime(flightStatus.actualArrival)}
                      </span>
                    </div>
                  ) : null}
                  {flightStatus.terminal ? (
                    <div className="orderSheetInfoRow">
                      <span className="orderSheetInfoLabel">{t('contract.terminal')}</span>
                      <span className="orderSheetInfoValue">{flightStatus.terminal}</span>
                    </div>
                  ) : null}
                  {flightStatus.baggageClaim ? (
                    <div className="orderSheetInfoRow">
                      <span className="orderSheetInfoLabel">{t('contract.baggageClaim')}</span>
                      <span className="orderSheetInfoValue">{flightStatus.baggageClaim}</span>
                    </div>
                  ) : null}
                  {flightStatus.updatedAt ? (
                    <div className="orderSheetInfoRow">
                      <span className="orderSheetInfoLabel">{t('contract.flightUpdatedAt')}</span>
                      <span className="orderSheetInfoValue">{formatDateTime(flightStatus.updatedAt)}</span>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="orderSheetCard">
              <div className="orderSheetSectionHeader">
                <OrderCardIcon name="file" tone="accent" />
                <h4 className="orderSheetSectionTitle">{t('contract.documentDetails')}</h4>
              </div>

              <div className="orderSheetRows">
                <div className="orderSheetInfoRow">
                  <div className="orderSheetInfoLead">
                    <OrderCardIcon name="tag" />
                    <span className="orderSheetInfoLabel">{t('contract.priceValue')}</span>
                  </div>
                  <div className="orderSheetPriceValue">
                    <span className="orderSheetInfoValue">{storedPrice || "-"}</span>
                    <button
                      className="orderSheetEditButton"
                      type="button"
                      onClick={openPriceEditor}
                      aria-label={t('contract.editPrice')}
                    >
                      <OrderGlyph name="edit" />
                    </button>
                  </div>
                </div>

                <div className="orderSheetInfoRow orderSheetInfoRow--commission">
                  <div className="orderSheetInfoLead">
                    <OrderCardIcon name="percent" />
                    <span className="orderSheetInfoLabel">{t('contract.commission')}</span>
                  </div>
                  <div className="orderSheetPriceValue">
                    <span className="orderSheetInfoValue">{storedCommission || "-"}</span>
                    <button
                      className="orderSheetEditButton"
                      type="button"
                      onClick={openCommissionEditor}
                      aria-label={t('contract.editCommission')}
                    >
                      <OrderGlyph name="edit" />
                    </button>
                  </div>
                </div>

                <div className="orderSheetInfoRow">
                  <div className="orderSheetInfoLead">
                    <OrderCardIcon name="wallet" />
                    <span className="orderSheetInfoLabel">{t('contract.payment')}</span>
                  </div>
                  <span className="orderSheetInfoValue">{trip.paymentMethod || "-"}</span>
                </div>

                {hasProviderData(orderProvider) ? (
                  <div className="orderSheetInfoRow orderSheetInfoRow--provider">
                    <div className="orderSheetInfoLead orderSheetInfoLead--alignStart">
                      <OrderCardIcon name="invoice" />
                      <span className="orderSheetInfoLabel">{t('contract.provider')}</span>
                    </div>
                    <div className="orderSheetProviderValue">
                      <span className="orderSheetInfoValue">{orderProvider.name || "-"}</span>
                      {providerMeta ? (
                        <span className="orderSheetProviderMeta">{providerMeta}</span>
                      ) : null}
                      {canSaveProvider ? (
                        <button
                          className="orderSheetProviderSaveButton"
                          type="button"
                          onClick={() => void handleSaveProviderToProfile()}
                          disabled={isSavingProvider}
                        >
                          <SvgIcon name="plus" />
                          <span>
                            {isSavingProvider ? t('common.saving') : t('contract.saveProviderToProfile')}
                          </span>
                        </button>
                      ) : (
                        <span className="orderSheetProviderSaved">
                          {t('contract.providerAlreadySaved')}
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="orderSheetTotalBar">
              <span className="orderSheetTotalIcon">
                <OrderGlyph name="wallet" />
              </span>
              <div className="orderSheetTotalCopy">
                <span className="orderSheetTotalLabel">{t('contract.amountDue')}</span>
                <strong className="orderSheetTotalValue">{amountDue}</strong>
              </div>
            </section>

            <div className="orderDrawer-actions orderDrawer-actions--doc">
              <button
                className="orderWindow-button orderWindow-button--doc"
                type="button"
                onClick={() => handleDownloadPdf("offer")}
                disabled={isGenerating}
              >
                {isGenerating ? <RequestLoader inline size="sm" label={t('common.generating')} /> : t('contract.offerPdf')}
              </button>
              <button
                className="orderWindow-button orderWindow-button--doc"
                type="button"
                onClick={() => handleDownloadPdf("confirmation")}
                disabled={isGenerating}
              >
                {isGenerating ? <RequestLoader inline size="sm" label={t('common.generating')} /> : t('contract.confirmationPdf')}
              </button>
            </div>

            <div className="orderDrawer-actions orderDrawer-actions--stacked">
              <button
                className="orderWindow-button orderWindow-button--success"
                type="button"
                onClick={handleSaveAndClose}
                disabled={isUpdatingOrder}
              >
                {isUpdatingOrder ? <RequestLoader inline size="sm" label={t('common.saving')} /> : t('common.save')}
              </button>
              {canTransfer ? (
                <button
                  className="orderWindow-button orderWindow-button--transfer"
                  type="button"
                  onClick={() => setShowTransfer(true)}
                >
                  {t('contract.transferOrder')}
                </button>
              ) : null}
              <button
                className="orderWindow-button orderWindow-button--danger"
                type="button"
                onClick={handleDelete}
              >
                {t('common.delete')}
              </button>
            </div>

            {showTransfer ? (
              <section className="orderDrawer-transfer">
                <div className="orderDrawer-sectionTitleRow">
                  <h4 className="orderDrawer-sectionTitle">{t('contract.transferToAnotherDriver')}</h4>
                  <p className="orderDrawer-transferCopy">{t('contract.chooseDriverHint')}</p>
                </div>

                <div className="orderDrawer-transferControls">
                  <label className="orderWindow-field">
                    <span>{t('common.search')}</span>
                    <input
                      type="text"
                      value={transferSearch}
                      onChange={(event) =>
                        setTransferSearch(event.target.value)
                      }
                      placeholder={t('contract.searchByNameOrEmail')}
                    />
                  </label>
                  <button
                    className="orderWindow-button orderWindow-button--secondary"
                    type="button"
                    onClick={() => setTransferSearch("")}
                    disabled={!transferSearch || isUsersFetching}
                  >
                    {t('common.reset')}
                  </button>
                </div>

                {isUsersFetching ? (
                  <RequestLoadingState className="orderWindow-state" label={t('contract.loadingDrivers')} />
                ) : null}

                {!isUsersFetching && transferUsers.length ? (
                  <ul className="orderWindow-userList">
                    {transferUsers.map((user) => {
                      const isActive = selectedUserId === user.id;
                      const isCurrentOwner = Boolean(
                        orderOwnerId && String(user.id) === orderOwnerId,
                      );

                      return (
                        <li key={user.id}>
                          <button
                            className={`orderWindow-userButton ${isActive ? "is-active" : ""}`}
                            type="button"
                            onClick={() => setSelectedUserId(user.id)}
                            disabled={isCurrentOwner}
                          >
                            <span className="orderWindow-userName">
                              {user.name || t('common.noName')}
                            </span>
                            <span className="orderWindow-userMeta">
                              {isCurrentOwner
                                ? t('contract.currentDriver')
                                : getTransferLabel(user)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}

                {!isUsersFetching && !transferUsers.length ? (
                  <p className="orderWindow-state">{t('contract.noDrivers')}</p>
                ) : null}

                {selectedTransferUser ? (
                  <div className="orderDrawer-selected">
                    <p className="orderWindow-label">{t('contract.selectedDriver')}</p>
                    <strong>{getTransferLabel(selectedTransferUser)}</strong>
                  </div>
                ) : null}

                <div className="orderDrawer-actions orderDrawer-actions--transfer">
                  <button
                    className="orderWindow-button orderWindow-button--accent"
                    type="button"
                    onClick={handleTransfer}
                    disabled={isTransferring || !selectedUserId}
                  >
                    {isTransferring ? (
                      <RequestLoader inline size="sm" label={t('common.transferring')} />
                    ) : (
                      t('contract.confirmTransfer')
                    )}
                  </button>
                  <button
                    className="orderWindow-button"
                    type="button"
                    onClick={() => setShowTransfer(false)}
                  >
                    {t('common.back')}
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      {priceEditorOpen ? (
        <div
          className="orderPriceEditor"
          role="presentation"
          onClick={closePriceEditor}
        >
          <div
            className="orderPriceEditor-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('contract.priceEditorTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="orderPriceEditor-header">
              <h4 className="orderPriceEditor-title">{t('contract.priceEditorTitle')}</h4>
              <p className="orderPriceEditor-copy">{t('contract.priceEditorCopy')}</p>
            </div>

            <div className="orderPriceEditor-field">
              <div className="orderCommissionField-row">
                <div className="orderCommissionField-inputWrap">
                  <input
                    className="orderWindow-input orderCommissionField-input"
                    type="text"
                    inputMode="decimal"
                    aria-label={t('contract.tripPrice')}
                    placeholder={`${t('contract.tripPrice')} *`}
                    value={priceInput}
                    onChange={handlePriceInputChange}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void savePrice();
                      }
                    }}
                  />
                </div>

                {["EUR", "CZK"].map((item) => (
                  <button
                    key={item}
                    className={`orderCommissionField-currencyButton ${priceCurrency === item ? "is-active" : ""}`}
                    type="button"
                    onClick={() => handlePriceCurrencyChange(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {priceInput ? (
                <p className="orderCommissionField-converted">
                  {formatPrice(priceInput, priceCurrency)}
                </p>
              ) : null}
            </div>

            <div className="orderPriceEditor-actions">
              <button
                className="orderWindow-button orderWindow-button--accent"
                type="button"
                onClick={() => void savePrice()}
                disabled={isUpdatingOrder}
              >
                {isUpdatingOrder ? <RequestLoader inline size="sm" label={t('common.saving')} /> : t('contract.savePrice')}
              </button>
              <button
                className="orderWindow-button orderWindow-button--secondary"
                type="button"
                onClick={closePriceEditor}
                disabled={isUpdatingOrder}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {commissionEditorOpen ? (
        <div
          className="orderPriceEditor"
          role="presentation"
          onClick={closeCommissionEditor}
        >
          <div
            className="orderPriceEditor-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('contract.commissionEditorTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="orderPriceEditor-header">
              <h4 className="orderPriceEditor-title">{t('contract.commissionEditorTitle')}</h4>
              <p className="orderPriceEditor-copy">{t('contract.commissionEditorCopy')}</p>
            </div>

            <div className="orderPriceEditor-field">
              <div className="orderCommissionField-row">
                <div className="orderCommissionField-inputWrap">
                  <input
                    className="orderWindow-input orderCommissionField-input"
                    type="text"
                    inputMode="decimal"
                    aria-label={t('contract.commission')}
                    placeholder={`${t('contract.commission')} *`}
                    value={commissionInput}
                    onChange={handleCommissionInputChange}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSaveCommission();
                      }
                    }}
                  />
                </div>

                {["EUR", "CZK"].map((item) => (
                  <button
                    key={item}
                    className={`orderCommissionField-currencyButton ${commissionCurrency === item ? "is-active" : ""}`}
                    type="button"
                    onClick={() => handleCommissionCurrencyChange(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {commissionConverted ? (
                <p className="orderCommissionField-converted">{commissionConverted}</p>
              ) : null}
            </div>

            <div className="orderPriceEditor-actions">
              <button
                className="orderWindow-button orderWindow-button--accent"
                type="button"
                onClick={() => void handleSaveCommission()}
                disabled={isUpdatingOrder}
              >
                {isUpdatingOrder ? <RequestLoader inline size="sm" label={t('common.saving')} /> : t('contract.saveCommission')}
              </button>
              <button
                className="orderWindow-button orderWindow-button--secondary"
                type="button"
                onClick={closeCommissionEditor}
                disabled={isUpdatingOrder}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {flightNumberEditorOpen ? (
        <div
          className="orderPriceEditor"
          role="presentation"
          onClick={closeFlightNumberEditor}
        >
          <div
            className="orderPriceEditor-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('contract.flightNumberEditorTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="orderPriceEditor-header">
              <h4 className="orderPriceEditor-title">{t('contract.flightNumberEditorTitle')}</h4>
              <p className="orderPriceEditor-copy">{t('contract.flightNumberEditorCopy')}</p>
            </div>

            <div className="orderPriceEditor-field">
              <input
                className="orderWindow-input orderPriceEditor-input"
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-label={t('contract.flightNumber')}
                placeholder={t('contract.flightNumber')}
                value={flightNumberInput}
                onChange={handleFlightNumberInputChange}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void saveFlightNumber();
                  }
                }}
              />
              <p className="orderPriceEditor-hint">{t('contract.flightNumberEditorHint')}</p>
            </div>

            <div className="orderPriceEditor-actions">
              <button
                className="orderWindow-button orderWindow-button--accent"
                type="button"
                onClick={() => void saveFlightNumber()}
                disabled={isUpdatingOrder}
              >
                {isUpdatingOrder ? <RequestLoader inline size="sm" label={t('common.saving')} /> : t('contract.saveFlightNumber')}
              </button>
              <button
                className="orderWindow-button orderWindow-button--secondary"
                type="button"
                onClick={closeFlightNumberEditor}
                disabled={isUpdatingOrder}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {contactActionsOpen ? (
        <div
          className="orderContactModal"
          role="presentation"
          onClick={closeContactActions}
        >
          <div
            className="orderContactModal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('contract.contactActionsTitle')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="orderPriceEditor-header">
              <h4 className="orderPriceEditor-title">{t('contract.contactActionsTitle')}</h4>
              <p className="orderPriceEditor-copy">{customerPhone}</p>
            </div>

            <div className="orderContactActions">
              {customerWhatsAppPhone ? (
                <a
                  className="orderContactAction orderContactAction--whatsapp"
                  href={`https://wa.me/${customerWhatsAppPhone}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={closeContactActions}
                >
                  <SvgIcon name="message-circle" />
                  <span>{t('contract.whatsapp')}</span>
                </a>
              ) : null}

              <a
                className="orderContactAction orderContactAction--call"
                href={`tel:${customerPhoneHref}`}
                onClick={closeContactActions}
              >
                <SvgIcon name="phone-call" />
                <span>{t('contract.callContact')}</span>
              </a>

              <a
                className="orderContactAction orderContactAction--message"
                href={`sms:${customerPhoneHref}`}
                onClick={closeContactActions}
              >
                <SvgIcon name="send" />
                <span>{t('contract.writeContact')}</span>
              </a>
            </div>

            <button
              className="orderWindow-button orderWindow-button--secondary"
              type="button"
              onClick={closeContactActions}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
