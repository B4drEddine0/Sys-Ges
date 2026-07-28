import type { Label, Section, User } from '@/types';

export const defaultUsers: User[] = [
  { id: 'me', name: 'Me', avatar: 'ME', color: '#2563eb' },
  { id: 'friend', name: 'My Friend', avatar: 'FR', color: '#0f766e' },
];

export const defaultSections: Section[] = [
  { id: 'frontend', name: 'Frontend', color: '#2563eb', order: 0 },
  { id: 'backend', name: 'Backend', color: '#0f766e', order: 1 },
];

export const defaultLabels: Label[] = [
  'UI',
  'UX',
  'API',
  'Backend',
  'Frontend',
  'Database',
  'Auth',
  'Refactor',
  'Performance',
  'Bug',
  'Responsive',
  'Testing',
  'Deployment',
  'Shared',
  'P0',
  'P1',
  'P2',
].map((name, index) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  color: ['#2563eb', '#0f766e', '#7c3aed', '#475569', '#0284c7', '#16a34a', '#d97706'][index % 7] ?? '#64748b',
  createdAt: new Date().toISOString(),
}));