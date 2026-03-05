import { LessorData, AgentData } from '../types';

// ─── Storage Keys ───────────────────────────────────────────────────────────
const OWNERS_KEY = 'tvm_saved_owners';
const AGENTS_KEY = 'tvm_saved_agents';

// ─── Owner / Lessor ─────────────────────────────────────────────────────────

export interface SavedOwner extends LessorData {
  id: string;
  savedAt: string;
}

export const getSavedOwners = (): SavedOwner[] => {
  try { return JSON.parse(localStorage.getItem(OWNERS_KEY) || '[]'); } catch { return []; }
};

export const saveOwner = (owner: LessorData): SavedOwner => {
  const list = getSavedOwners();
  // If same name already exists, update it
  const existing = list.findIndex(o => o.name.toLowerCase() === owner.name.toLowerCase());
  const saved: SavedOwner = {
    ...owner,
    id: existing >= 0 ? list[existing].id : Date.now().toString(),
    savedAt: new Date().toISOString(),
  };
  if (existing >= 0) list[existing] = saved;
  else list.push(saved);
  localStorage.setItem(OWNERS_KEY, JSON.stringify(list));
  return saved;
};

export const deleteOwner = (id: string) => {
  const list = getSavedOwners().filter(o => o.id !== id);
  localStorage.setItem(OWNERS_KEY, JSON.stringify(list));
};

// ─── Agent / Partner ─────────────────────────────────────────────────────────

export interface SavedAgent {
  id: string;
  savedAt: string;
  // Quick-view fields
  companyName: string;
  agentPIC: string;
  partnershipType: string;
  whatsappNumber: string;
  agentEmail: string;
  // Full data
  data: AgentData;
}

export const getSavedAgents = (): SavedAgent[] => {
  try { return JSON.parse(localStorage.getItem(AGENTS_KEY) || '[]'); } catch { return []; }
};

export const saveAgent = (agent: AgentData): SavedAgent => {
  const list = getSavedAgents();
  const label = agent.companyName || agent.picFullName || agent.agentPIC;
  const existing = list.findIndex(
    a => (a.companyName || a.agentPIC).toLowerCase() === label.toLowerCase()
  );
  const saved: SavedAgent = {
    id: existing >= 0 ? list[existing].id : Date.now().toString(),
    savedAt: new Date().toISOString(),
    companyName: agent.companyName,
    agentPIC: agent.agentPIC,
    partnershipType: agent.partnershipType,
    whatsappNumber: agent.whatsappNumber,
    agentEmail: agent.agentEmail,
    data: agent,
  };
  if (existing >= 0) list[existing] = saved;
  else list.push(saved);
  localStorage.setItem(AGENTS_KEY, JSON.stringify(list));
  return saved;
};

export const deleteAgent = (id: string) => {
  const list = getSavedAgents().filter(a => a.id !== id);
  localStorage.setItem(AGENTS_KEY, JSON.stringify(list));
};
