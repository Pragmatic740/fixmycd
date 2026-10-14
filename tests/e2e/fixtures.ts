export const E2E_DB = 'fixmycd_e2e';
export const E2E_PASSWORD = 'e2e-password-123';
export const E2E_USERS = {
  citizen: { id: 'e2e_citizen', email: 'citizen@e2e.test', name: 'Casey Citizen', role: 'submitter' },
  neighbour: { id: 'e2e_neighbour', email: 'neighbour@e2e.test', name: 'Nia Neighbour', role: 'submitter' },
  admin: { id: 'e2e_admin', email: 'admin@e2e.test', name: 'Ada Admin', role: 'admin' },
} as const;
