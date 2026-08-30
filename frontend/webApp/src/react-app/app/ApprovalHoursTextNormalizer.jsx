import { useEffect } from 'react';

function formatDecimalHoursMatch(match, sign = '', whole = '0', fraction = '00') {
  const decimal = Number(`0.${fraction}`);
  let hours = Number(whole);
  let minutes = Math.round(decimal * 60);

  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }

  const prefix = sign || '';
  if (minutes === 0) return `${prefix}${hours} h`;
  return `${prefix}${hours} h ${minutes} min`;
}

function normalizeText(text) {
  return text.replace(/([+-]?)(\d+)\.(\d{2})\s*h\b/g, formatDecimalHoursMatch);
}

function normalizeApprovalsHours(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];

  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    const current = node.nodeValue || '';
    if (!/([+-]?)(\d+)\.(\d{2})\s*h\b/.test(current)) return;
    node.nodeValue = normalizeText(current);
  });
}

export function ApprovalHoursTextNormalizer() {
  useEffect(() => {
    const apply = () => {
      const root = document.querySelector('.approvalsPage');
      if (root) normalizeApprovalsHours(root);
    };

    apply();

    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
