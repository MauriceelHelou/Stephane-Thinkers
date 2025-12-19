// Pre-defined thinker data for tests
export const FAMOUS_PHILOSOPHERS = [
  {
    name: 'Immanuel Kant',
    birth_year: 1724,
    death_year: 1804,
    field: 'Philosophy',
    biography_notes: 'German philosopher who is a central figure in modern philosophy.',
    active_period: '18th century',
  },
  {
    name: 'Georg Wilhelm Friedrich Hegel',
    birth_year: 1770,
    death_year: 1831,
    field: 'Philosophy',
    biography_notes: 'German philosopher and important figure of German idealism.',
    active_period: 'Early 19th century',
  },
  {
    name: 'Karl Marx',
    birth_year: 1818,
    death_year: 1883,
    field: 'Economics',
    biography_notes: 'German philosopher, economist, historian, sociologist, political theorist.',
    active_period: '19th century',
  },
  {
    name: 'Friedrich Nietzsche',
    birth_year: 1844,
    death_year: 1900,
    field: 'Philosophy',
    biography_notes: 'German philosopher, cultural critic, composer, poet, writer.',
    active_period: 'Late 19th century',
  },
  {
    name: 'Martin Heidegger',
    birth_year: 1889,
    death_year: 1976,
    field: 'Philosophy',
    biography_notes: 'German philosopher best known for contributions to phenomenology and existentialism.',
    active_period: '20th century',
  },
  {
    name: 'Hannah Arendt',
    birth_year: 1906,
    death_year: 1975,
    field: 'Political Theory',
    biography_notes: 'German-born American political theorist.',
    active_period: 'Mid 20th century',
  },
  {
    name: 'John Rawls',
    birth_year: 1921,
    death_year: 2002,
    field: 'Political Philosophy',
    biography_notes: 'American moral and political philosopher.',
    active_period: 'Late 20th century',
  },
  {
    name: 'Michel Foucault',
    birth_year: 1926,
    death_year: 1984,
    field: 'Philosophy',
    biography_notes: 'French philosopher, historian of ideas, social theorist, and literary critic.',
    active_period: 'Late 20th century',
  },
]

export const ANCIENT_PHILOSOPHERS = [
  {
    name: 'Plato',
    birth_year: -428,
    death_year: -348,
    field: 'Philosophy',
    biography_notes: 'Athenian philosopher during the Classical period in Ancient Greece.',
    active_period: '4th century BCE',
  },
  {
    name: 'Aristotle',
    birth_year: -384,
    death_year: -322,
    field: 'Philosophy',
    biography_notes: 'Greek philosopher and polymath during the Classical period in Ancient Greece.',
    active_period: '4th century BCE',
  },
  {
    name: 'Socrates',
    birth_year: -470,
    death_year: -399,
    field: 'Philosophy',
    biography_notes: 'Greek philosopher credited as the founder of Western philosophy.',
    active_period: '5th century BCE',
  },
]

export const ENLIGHTENMENT_THINKERS = [
  {
    name: 'John Locke',
    birth_year: 1632,
    death_year: 1704,
    field: 'Philosophy',
    biography_notes: 'English philosopher and physician, known as the "Father of Liberalism".',
    active_period: '17th century',
  },
  {
    name: 'David Hume',
    birth_year: 1711,
    death_year: 1776,
    field: 'Philosophy',
    biography_notes: 'Scottish Enlightenment philosopher, historian, economist, librarian.',
    active_period: '18th century',
  },
  {
    name: 'Jean-Jacques Rousseau',
    birth_year: 1712,
    death_year: 1778,
    field: 'Philosophy',
    biography_notes: 'Genevan philosopher, writer, and composer.',
    active_period: '18th century',
  },
  {
    name: 'Voltaire',
    birth_year: 1694,
    death_year: 1778,
    field: 'Philosophy',
    biography_notes: 'French Enlightenment writer, historian, and philosopher.',
    active_period: '18th century',
  },
]

export const TEST_THINKERS = {
  philosopher1: {
    name: 'Test Philosopher 1',
    birth_year: 1800,
    death_year: 1870,
    field: 'Philosophy',
    biography_notes: 'A test philosopher for E2E testing.',
  },
  philosopher2: {
    name: 'Test Philosopher 2',
    birth_year: 1820,
    death_year: 1890,
    field: 'Ethics',
    biography_notes: 'Another test philosopher for E2E testing.',
  },
  philosopher3: {
    name: 'Test Philosopher 3',
    birth_year: 1850,
    death_year: 1920,
    field: 'Metaphysics',
    biography_notes: 'A third test philosopher for E2E testing.',
  },
}

// For edge case testing
export const EDGE_CASE_THINKERS = {
  noDeathYear: {
    name: 'Living Philosopher',
    birth_year: 1950,
    death_year: null,
    field: 'Contemporary Philosophy',
  },
  noBirthYear: {
    name: 'Unknown Birth Philosopher',
    birth_year: null,
    death_year: 1500,
    field: 'Medieval Philosophy',
  },
  noDates: {
    name: 'Undated Philosopher',
    birth_year: null,
    death_year: null,
    field: 'Philosophy',
  },
  specialCharacters: {
    name: "René Descartes (L'homme)",
    birth_year: 1596,
    death_year: 1650,
    field: 'Philosophy & Mathematics',
  },
  longName: {
    name: 'Johann Wolfgang von Goethe the Elder, Baron of Weimar and Minister of State',
    birth_year: 1749,
    death_year: 1832,
    field: 'Literature',
  },
}
