/**
 * The category taxonomy. Course counts are fixed by docs/02-dataset-spec.md §2
 * and asserted by the dataset generator, so they live next to the ids rather
 * than being recounted from the data.
 */

export type CategoryId =
  'ai-ml' | 'web-dev' | 'data-analytics' | 'design-ux' | 'business-marketing' | 'cybersecurity';

/**
 * The full subcategory taxonomy, invented in Phase 2 alongside the dataset.
 * Only `applied-ml` is named in the specs (docs/02-dataset-spec.md §3); the
 * rest follow the same one-word-per-topic convention.
 */
export type SubcategoryId =
  | 'applied-ml'
  | 'deep-learning'
  | 'nlp'
  | 'mlops'
  | 'prompt-engineering'
  | 'frontend'
  | 'backend'
  | 'fullstack-typescript'
  | 'mobile'
  | 'devops-web'
  | 'sql-analytics'
  | 'data-visualization'
  | 'data-engineering'
  | 'business-intelligence'
  | 'ux-research'
  | 'ui-design'
  | 'design-systems'
  | 'product-design'
  | 'growth-marketing'
  | 'product-management'
  | 'entrepreneurship'
  | 'digital-marketing'
  | 'ethical-hacking'
  | 'network-security'
  | 'cloud-security'
  | 'security-fundamentals';

export interface Subcategory {
  readonly id: SubcategoryId;
  readonly name: string;
}

export interface Category {
  readonly id: CategoryId;
  readonly name: string;
  /** Fixed by docs/02-dataset-spec.md §2; the generator asserts it. */
  readonly courseCount: number;
  /** One-line note on what this category is for in the demo. */
  readonly role: string;
  readonly subcategories: readonly Subcategory[];
}

/**
 * The default view (PRD §7, criterion 1). The hero category carries almost
 * every planted case, which is why the reviewer lands on it.
 */
export const HERO_CATEGORY_ID = 'ai-ml' satisfies CategoryId;

export const CATEGORIES: readonly Category[] = [
  {
    id: 'ai-ml',
    name: 'AI & Machine Learning',
    courseCount: 16,
    role: 'Hero category. The default view. Carries almost every planted case.',
    subcategories: [
      { id: 'applied-ml', name: 'Applied ML' },
      { id: 'deep-learning', name: 'Deep Learning' },
      { id: 'nlp', name: 'NLP' },
      { id: 'mlops', name: 'MLOps' },
      { id: 'prompt-engineering', name: 'Prompt Engineering' },
    ],
  },
  {
    id: 'web-dev',
    name: 'Web Development',
    courseCount: 13,
    role: 'The only promo case outside the hero category; general depth.',
    subcategories: [
      { id: 'frontend', name: 'Frontend' },
      { id: 'backend', name: 'Backend' },
      { id: 'fullstack-typescript', name: 'Full-Stack TypeScript' },
      { id: 'mobile', name: 'Mobile' },
      { id: 'devops-web', name: 'DevOps for Web' },
    ],
  },
  {
    id: 'data-analytics',
    name: 'Data & Analytics',
    courseCount: 10,
    role: 'Balanced baseline; one non-English course.',
    subcategories: [
      { id: 'sql-analytics', name: 'SQL & Analytics' },
      { id: 'data-visualization', name: 'Data Visualization' },
      { id: 'data-engineering', name: 'Data Engineering' },
      { id: 'business-intelligence', name: 'Business Intelligence' },
    ],
  },
  {
    id: 'design-ux',
    name: 'Design & UX',
    courseCount: 10,
    role: 'Low prices, high completion — a visibly different profile.',
    subcategories: [
      { id: 'ux-research', name: 'UX Research' },
      { id: 'ui-design', name: 'UI Design' },
      { id: 'design-systems', name: 'Design Systems' },
      { id: 'product-design', name: 'Product Design' },
    ],
  },
  {
    id: 'business-marketing',
    name: 'Business & Marketing',
    courseCount: 10,
    role: 'Weakest outcome metrics, strongest marketing.',
    subcategories: [
      { id: 'growth-marketing', name: 'Growth Marketing' },
      { id: 'product-management', name: 'Product Management' },
      { id: 'entrepreneurship', name: 'Entrepreneurship' },
      { id: 'digital-marketing', name: 'Digital Marketing' },
    ],
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity',
    courseCount: 5,
    role: 'Deliberately small — the only category below the <10 fallback threshold.',
    subcategories: [
      { id: 'ethical-hacking', name: 'Ethical Hacking' },
      { id: 'network-security', name: 'Network Security' },
      { id: 'cloud-security', name: 'Cloud Security' },
      { id: 'security-fundamentals', name: 'Security Fundamentals' },
    ],
  },
];

export function getCategory(id: CategoryId): Category {
  const category = CATEGORIES.find((candidate) => candidate.id === id);
  if (category === undefined) {
    throw new Error(`Unknown category id: ${id}`);
  }
  return category;
}
