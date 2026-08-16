import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { BackButton } from '@shared/app/components/BackButton/BackButton.jsx';
import { RequestLoader, RequestLoadingState } from '@shared/app/components/RequestLoader/RequestLoader.jsx';
import { SvgIcon } from '@shared/app/components/SvgIcon/SvgIcon.jsx';
import { useI18n } from '@shared/app/i18n/useI18n.js';
import {
  useGetTeamQuery,
  useUpdateTeamMutation,
} from '@shared/features/auth/authApi.js';
import { saveSession } from '@shared/features/auth/authStorage.js';
import { selectToken, setSession } from '@shared/features/auth/authSlice.js';
import './TeamPage.css';

const TEAM_DRAFT_KEY = 'driver-team-draft';

function readTeamDraft() {
  try {
    const rawDraft = sessionStorage.getItem(TEAM_DRAFT_KEY);
    if (!rawDraft) {
      return null;
    }

    const draft = JSON.parse(rawDraft);
    return draft && typeof draft === 'object' ? draft : null;
  } catch {
    return null;
  }
}

function writeTeamDraft(draft) {
  try {
    sessionStorage.setItem(TEAM_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage errors.
  }
}

function clearTeamDraft() {
  try {
    sessionStorage.removeItem(TEAM_DRAFT_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function getAvatarUrl(driver) {
  return driver?.profile?.avatarUrl || driver?.avatarUrl || '';
}

function getInitials(driver) {
  const source = driver?.name || driver?.email || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function TeamDriverAvatar({ driver }) {
  const [hasError, setHasError] = useState(false);
  const avatarUrl = getAvatarUrl(driver);

  if (hasError || !avatarUrl) {
    return <span className="teamPage-avatarFallback">{getInitials(driver)}</span>;
  }

  return (
    <img
      className="teamPage-avatarImage"
      src={avatarUrl}
      alt=""
      onError={() => setHasError(true)}
    />
  );
}

function makeTeamId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIds(ids) {
  return Array.from(new Set(Array.isArray(ids) ? ids.filter(Boolean) : [])).sort();
}

function normalizeTeams(teams, fallbackDriverIds = [], t) {
  const source = Array.isArray(teams) ? teams : [];
  const seen = new Set();
  const normalized = [];

  source.forEach((item, index) => {
    const team = item && typeof item === 'object' ? item : {};
    let id = String(team.id || '').trim() || `team-${index + 1}`;

    if (seen.has(id)) {
      id = `${id}-${index + 1}`;
    }

    seen.add(id);
    normalized.push({
      id,
      name: String(team.name || '').trim() || `${t('settings.team.defaultTeamName')} ${index + 1}`,
      driverIds: normalizeIds(team.driverIds || team.teamDriverIds),
    });
  });

  const legacyDriverIds = normalizeIds(fallbackDriverIds);
  if (!normalized.length && legacyDriverIds.length) {
    return [
      {
        id: 'default',
        name: t('settings.team.defaultTeamName'),
        driverIds: legacyDriverIds,
      },
    ];
  }

  return normalized;
}

function sameTeams(left, right) {
  return JSON.stringify(normalizeTeams(left, [], key => key)) ===
    JSON.stringify(normalizeTeams(right, [], key => key));
}

function getDriverSearchText(driver) {
  return [
    driver?.name,
    driver?.email,
    driver?.phone,
    driver?.profile?.driver?.name,
    driver?.profile?.driver?.spz,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function useTeamEditor() {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const { language, t } = useI18n();
  const { data, isLoading, isFetching, isError } = useGetTeamQuery();
  const [updateTeam, { isLoading: isSaving }] = useUpdateTeamMutation();
  const [search, setSearch] = useState('');
  const [teams, setTeams] = useState([]);
  const [initialTeams, setInitialTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState('');
  const [initialActiveTeamId, setInitialActiveTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const drivers = useMemo(() => data?.drivers || [], [data]);
  const activeTeam = useMemo(
    () => teams.find(team => team.id === activeTeamId) || teams[0] || null,
    [activeTeamId, teams]
  );
  const selectedIds = activeTeam?.driverIds || [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleDrivers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const source = showSelectedOnly
      ? drivers.filter(driver => selectedSet.has(driver.id))
      : drivers;

    if (!query) {
      return source;
    }

    return source.filter(driver => getDriverSearchText(driver).includes(query));
  }, [drivers, search, selectedSet, showSelectedOnly]);
  const hasChanges = activeTeamId !== initialActiveTeamId || !sameTeams(teams, initialTeams);

  useEffect(() => {
    if (!data) {
      return;
    }

    const serverTeams = normalizeTeams(data.teams, data.teamDriverIds, t);
    const serverActiveTeam =
      serverTeams.find(team => team.id === data.activeTeamId) || serverTeams[0] || null;
    const serverActiveTeamId = serverActiveTeam?.id || '';
    const draft = readTeamDraft();
    const draftTeams = draft ? normalizeTeams(draft.teams, [], t) : serverTeams;
    const draftActiveTeam =
      draftTeams.find(team => team.id === draft?.activeTeamId) || draftTeams[0] || null;
    const draftActiveTeamId = draft ? draftActiveTeam?.id || '' : serverActiveTeamId;

    setTeams(draftTeams);
    setInitialTeams(serverTeams);
    setActiveTeamId(draftActiveTeamId);
    setInitialActiveTeamId(serverActiveTeamId);
  }, [data, language]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (hasChanges) {
      writeTeamDraft({ activeTeamId, teams });
      return;
    }

    clearTeamDraft();
  }, [activeTeamId, data, hasChanges, teams]);

  function resetFeedback() {
    setMessage('');
    setError('');
  }

  function updateActiveTeamDriverIds(updater) {
    if (!activeTeam) {
      setError(t('settings.team.createTeamFirst'));
      return;
    }

    resetFeedback();
    setTeams(current =>
      current.map(team =>
        team.id === activeTeam.id
          ? {
              ...team,
              driverIds: normalizeIds(
                typeof updater === 'function' ? updater(team.driverIds) : updater
              ),
            }
          : team
      )
    );
  }

  function applySavedTeamResponse(response, fallbackActiveTeamId, fallbackTeams) {
    const nextTeams = normalizeTeams(response?.teams || fallbackTeams, response?.teamDriverIds, t);
    const nextActiveTeam =
      nextTeams.find(team => team.id === (response?.activeTeamId || fallbackActiveTeamId)) ||
      nextTeams[0] ||
      null;
    const nextActiveTeamId = nextActiveTeam?.id || '';

    setTeams(nextTeams);
    setInitialTeams(nextTeams);
    setActiveTeamId(nextActiveTeamId);
    setInitialActiveTeamId(nextActiveTeamId);
    clearTeamDraft();

    if (response?.user && token) {
      saveSession(token, response.user);
      dispatch(setSession({ token, user: response.user }));
    }
  }

  async function createTeam(event) {
    event.preventDefault();
    resetFeedback();

    const name = teamName.trim();
    if (!name) {
      return;
    }

    const nextTeam = {
      id: makeTeamId(),
      name,
      driverIds: [],
    };
    const previousTeams = teams;
    const previousActiveTeamId = activeTeamId;
    const nextTeams = [...teams, nextTeam];

    setTeams(nextTeams);
    setActiveTeamId(nextTeam.id);
    setTeamName('');

    try {
      const response = await updateTeam({
        activeTeamId: nextTeam.id,
        teams: nextTeams,
      }).unwrap();

      applySavedTeamResponse(response, nextTeam.id, nextTeams);
      setMessage(t('settings.team.created'));
      setIsCreateOpen(false);
    } catch {
      setTeams(previousTeams);
      setActiveTeamId(previousActiveTeamId);
      setError(t('settings.team.failed'));
    }
  }

  async function deleteTeam(teamId) {
    const targetTeam = teams.find(team => team.id === teamId);
    if (!targetTeam) {
      return;
    }

    resetFeedback();

    const previousTeams = teams;
    const previousActiveTeamId = activeTeamId;
    const nextTeams = teams.filter(team => team.id !== targetTeam.id);
    const nextActiveTeam = nextTeams.find(team => team.id === activeTeamId) || nextTeams[0] || null;
    const nextActiveTeamId = nextActiveTeam?.id || '';

    setTeams(nextTeams);
    setActiveTeamId(nextActiveTeamId);

    try {
      const response = await updateTeam({
        activeTeamId: nextActiveTeamId,
        teams: nextTeams,
      }).unwrap();

      applySavedTeamResponse(response, nextActiveTeamId, nextTeams);
      setMessage(t('settings.team.deleted'));
    } catch {
      setTeams(previousTeams);
      setActiveTeamId(previousActiveTeamId);
      setError(t('settings.team.failed'));
    }
  }

  function toggleDriver(driverId) {
    updateActiveTeamDriverIds(current => {
      if (current.includes(driverId)) {
        return current.filter(id => id !== driverId);
      }

      return [...current, driverId];
    });
  }

  function selectVisibleDrivers() {
    updateActiveTeamDriverIds(current => {
      const next = new Set(current);
      visibleDrivers.forEach(driver => next.add(driver.id));
      return Array.from(next);
    });
  }

  function clearSelectedDrivers() {
    updateActiveTeamDriverIds([]);
  }

  async function handleSave() {
    resetFeedback();

    try {
      const response = await updateTeam({ activeTeamId, teams }).unwrap();
      applySavedTeamResponse(response, activeTeamId, teams);
      setMessage(t('settings.team.saved'));
    } catch {
      setError(t('settings.team.failed'));
    }
  }

  return {
    activeTeam,
    activeTeamId,
    createTeam,
    deleteTeam,
    drivers,
    error,
    handleSave,
    hasChanges,
    isError,
    isCreateOpen,
    isFetching,
    isLoading,
    isSaving,
    message,
    search,
    selectedCount: selectedIds.length,
    selectedSet,
    clearSelectedDrivers,
    selectVisibleDrivers,
    setActiveTeamId,
    setIsCreateOpen,
    setSearch,
    setShowSelectedOnly,
    setTeamName,
    showSelectedOnly,
    t,
    teamName,
    teams,
    toggleDriver,
    visibleDrivers,
  };
}

function TeamHeader({ backTo, subtitle, title }) {
  return (
    <header className="teamPage-header">
      <BackButton to={backTo} />

      <div className="appTitleBlock">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

function TeamCreateForm({
  createTeam,
  isCreateOpen,
  isSaving,
  setIsCreateOpen,
  setTeamName,
  t,
  teamName,
}) {
  if (!isCreateOpen) {
    return (
      <button className="teamPage-createTile" type="button" onClick={() => setIsCreateOpen(true)}>
        <span className="teamPage-createPlus" aria-hidden="true">
          <SvgIcon name="plus" />
        </span>
        <strong>{t('settings.team.createTeamTitle')}</strong>
        <span>{t('settings.team.createTeamCopy')}</span>
      </button>
    );
  }

  return (
    <form className="teamPage-createTile teamPage-createTile--open" onSubmit={createTeam}>
      <span className="teamPage-createPlus" aria-hidden="true">
        <SvgIcon name="plus" />
      </span>
      <label className="teamPage-createField">
        <span>{t('settings.team.teamNameLabel')}</span>
        <input
          type="text"
          value={teamName}
          onChange={event => setTeamName(event.target.value)}
          placeholder={t('settings.team.teamNamePlaceholder')}
        />
      </label>
      <div className="teamPage-createActions">
        <button className="teamPage-save" type="submit" disabled={isSaving || !teamName.trim()}>
          {isSaving ? <RequestLoader inline size="sm" label={t('common.saving')} /> : t('settings.team.createTeam')}
        </button>
        <button
          className="teamPage-actionButton"
          type="button"
          onClick={() => setIsCreateOpen(false)}
          disabled={isSaving}
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

function TeamBadgeIcon({ className = '' }) {
  return (
    <span className={`teamPage-teamIcon ${className}`.trim()} aria-hidden="true">
      <SvgIcon name="accounts" />
    </span>
  );
}

function TeamSummary({ activeTeam, children, selectedCount, totalCount, t }) {
  return (
    <div className="teamPage-summary">
      <div className="teamPage-summaryCopy">
        <TeamBadgeIcon />
        <div>
          <p>{activeTeam?.name || t('settings.team.activeTeam')}</p>
          <strong>
            {t('settings.team.selectedCountWithDrivers', {
              count: selectedCount,
              total: totalCount,
            })}
          </strong>
        </div>
      </div>

      {children ? <div className="teamPage-summaryActions">{children}</div> : null}
    </div>
  );
}

function TeamCards({ activeTeamId, deleteTeam, driversCount, isSaving, setActiveTeamId, t, teams }) {
  if (!teams.length) {
    return <p className="teamPage-state">{t('settings.team.noTeams')}</p>;
  }

  return (
    <ul className="teamPage-teamGrid">
      {teams.map(team => (
        <li key={team.id}>
          <article className={`teamPage-teamCard ${team.id === activeTeamId ? 'is-active' : ''}`}>
            <div className="teamPage-teamCardHeader">
              <TeamBadgeIcon />
              <div className="teamPage-teamCardCopy">
                <strong>{team.name}</strong>
                <span>
                  <SvgIcon name="user" />
                  {t('settings.team.selectedCountWithDrivers', {
                    count: team.driverIds.length,
                    total: driversCount,
                  })}
                </span>
              </div>
              <span className="teamPage-menuDots" aria-hidden="true">•••</span>
            </div>

            <div className="teamPage-teamCardActions">
              <Link
                className="teamPage-cardAction teamPage-cardAction--open"
                to="/settings/team/search"
                onClick={() => setActiveTeamId(team.id)}
              >
                <span>{t('settings.team.goToTeam')}</span>
                <SvgIcon name="chevron-right" />
              </Link>
              <button
                className="teamPage-cardAction teamPage-cardAction--danger"
                type="button"
                onClick={() => deleteTeam(team.id)}
                disabled={isSaving}
              >
                {isSaving ? (
                  <RequestLoader inline size="sm" label={t('common.saving')} />
                ) : (
                  <>
                    <SvgIcon name="trash" />
                    <span>{t('settings.team.deleteTeam')}</span>
                  </>
                )}
              </button>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function TeamFeedback({ error, isError, isFetching, isLoading, message, t }) {
  return (
    <>
      {message ? <p className="teamPage-message">{message}</p> : null}
      {error ? <p className="teamPage-error">{error}</p> : null}
      {isLoading || isFetching ? (
        <RequestLoadingState className="teamPage-state" label={t('settings.team.loading')} />
      ) : null}
      {isError ? (
        <p className="teamPage-state teamPage-state--error">{t('settings.team.failedLoad')}</p>
      ) : null}
    </>
  );
}

function TeamDriverList({ drivers, onToggle, selectedOnly = false, selectedSet, t }) {
  if (!drivers.length) {
    return null;
  }

  return (
    <ul className="teamPage-driverList">
      {drivers.map(driver => {
        const isSelected = selectedOnly || selectedSet.has(driver.id);

        return (
          <li className="teamPage-driverItem" key={driver.id}>
            <button
              className={`teamPage-driverButton ${isSelected ? 'is-selected' : ''} ${
                selectedOnly ? 'teamPage-driverButton--selectedOnly' : ''
              }`}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(driver.id)}
            >
              <span className="teamPage-avatar" aria-hidden="true">
                <TeamDriverAvatar driver={driver} />
              </span>

              <span className="teamPage-driverCopy">
                <strong>{driver.name || t('common.noName')}</strong>
                <span>{driver.email || '-'}</span>
              </span>

              <span className="teamPage-driverMeta">
                {selectedOnly ? (
                  <span className="teamPage-remove" title={t('settings.team.remove')}>
                    <SvgIcon name="clear" />
                  </span>
                ) : (
                  <span className={`teamPage-driverAction ${isSelected ? 'is-selected' : ''}`}>
                    <SvgIcon name={isSelected ? 'check-circle' : 'plus'} />
                    <span>{isSelected ? t('settings.team.added') : t('settings.team.addDriver')}</span>
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function TeamPage() {
  const team = useTeamEditor();
  const {
    activeTeamId,
    createTeam,
    deleteTeam,
    drivers,
    error,
    isError,
    isCreateOpen,
    isFetching,
    isLoading,
    isSaving,
    message,
    setActiveTeamId,
    setIsCreateOpen,
    setTeamName,
    t,
    teamName,
    teams,
  } = team;

  return (
    <section className="teamPage pageStack">
      <TeamHeader
        backTo="/settings"
        title={t('settings.team.title')}
        subtitle={t('settings.team.subtitle')}
      />

      <section className="teamPage-section">
        <TeamFeedback
          error={error}
          isError={isError}
          isFetching={isFetching}
          isLoading={isLoading}
          message={message}
          t={t}
        />

        {!isLoading && !isError ? (
          <TeamCards
            activeTeamId={activeTeamId}
            deleteTeam={deleteTeam}
            driversCount={drivers.length}
            isSaving={isSaving}
            setActiveTeamId={setActiveTeamId}
            t={t}
            teams={teams}
          />
        ) : null}
      </section>

      <section className="teamPage-section">
        <TeamCreateForm
          createTeam={createTeam}
          isCreateOpen={isCreateOpen}
          isSaving={isSaving}
          setIsCreateOpen={setIsCreateOpen}
          setTeamName={setTeamName}
          t={t}
          teamName={teamName}
        />
      </section>

      <aside className="teamPage-tip">
        <div className="teamPage-tipTitle">
          <SvgIcon name="token" />
          <strong>{t('settings.team.tipTitle')}</strong>
        </div>
        <p>{t('settings.team.tipCopy')}</p>
      </aside>
    </section>
  );
}

export function TeamSearchPage() {
  const team = useTeamEditor();
  const {
    activeTeam,
    createTeam,
    drivers,
    error,
    handleSave,
    hasChanges,
    isError,
    isCreateOpen,
    isFetching,
    isLoading,
    isSaving,
    message,
    search,
    selectedCount,
    selectedSet,
    clearSelectedDrivers,
    selectVisibleDrivers,
    setIsCreateOpen,
    setSearch,
    setShowSelectedOnly,
    setTeamName,
    showSelectedOnly,
    t,
    teamName,
    teams,
    toggleDriver,
    visibleDrivers,
  } = team;
  const hasDriverFilter = Boolean(search.trim()) || showSelectedOnly;
  const canShowDrivers = !isLoading && !isError && Boolean(activeTeam) && hasDriverFilter;
  const selectedVisibleCount = visibleDrivers.filter(driver => selectedSet.has(driver.id)).length;
  const searchSubtitle = activeTeam
    ? t('settings.team.searchSubtitleWithTeam', { team: activeTeam.name })
    : t('settings.team.searchSubtitle');

  return (
    <section className="teamPage pageStack">
      <TeamHeader
        backTo="/settings/team"
        title={t('settings.team.searchTitle')}
        subtitle={searchSubtitle}
      />

      <section className="teamPage-section teamPage-searchSection">
        {!teams.length ? (
          <TeamCreateForm
            createTeam={createTeam}
            isCreateOpen={isCreateOpen}
            isSaving={isSaving}
            setIsCreateOpen={setIsCreateOpen}
            setTeamName={setTeamName}
            t={t}
            teamName={teamName}
          />
        ) : null}

        {activeTeam ? (
          <TeamSummary
            activeTeam={activeTeam}
            selectedCount={selectedCount}
            totalCount={drivers.length}
            t={t}
          >
            <button
              className="teamPage-save"
              type="button"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? <RequestLoader inline size="sm" label={t('common.saving')} /> : t('settings.team.save')}
            </button>
          </TeamSummary>
        ) : null}

        {!activeTeam ? <p className="teamPage-state">{t('settings.team.createTeamFirst')}</p> : null}

        {activeTeam ? (
          <>
            <div className="teamPage-searchRow">
              <label className="teamPage-search">
                <SvgIcon name="search" />
                <input
                  type="search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder={t('settings.team.searchPlaceholder')}
                />
              </label>

              <button
                className={`teamPage-filterButton ${showSelectedOnly ? 'is-active' : ''}`}
                type="button"
                onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                title={showSelectedOnly ? t('settings.team.showAllDrivers') : t('settings.team.showSelectedOnly')}
              >
                <SvgIcon name="filter" />
              </button>
            </div>

            {canShowDrivers ? (
              <div className="teamPage-selectBar">
                <div className="teamPage-selectActions">
                  <button
                    type="button"
                    onClick={selectVisibleDrivers}
                    disabled={!visibleDrivers.length || isSaving}
                  >
                    {t('settings.team.selectVisible')}
                  </button>
                  <button
                    className="teamPage-clearSelection"
                    type="button"
                    onClick={clearSelectedDrivers}
                    disabled={!selectedCount || isSaving}
                  >
                    {t('settings.team.clearSelection')}
                  </button>
                </div>
                <span>{t('settings.team.selectedShort', { count: selectedVisibleCount })}</span>
              </div>
            ) : null}
          </>
        ) : null}

        <TeamFeedback
          error={error}
          isError={isError}
          isFetching={isFetching}
          isLoading={isLoading}
          message={message}
          t={t}
        />

        {canShowDrivers && visibleDrivers.length ? (
          <TeamDriverList
            drivers={visibleDrivers}
            onToggle={toggleDriver}
            selectedSet={selectedSet}
            t={t}
          />
        ) : null}

        {canShowDrivers && !visibleDrivers.length ? (
          <p className="teamPage-state">{t('settings.team.empty')}</p>
        ) : null}
      </section>
    </section>
  );
}
