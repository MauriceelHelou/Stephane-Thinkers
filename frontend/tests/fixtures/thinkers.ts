// Pre-defined thinker data for tests
export const FAMOUS_PHILOSOPHERS = [
  {
    name: 'Meister Eckhart',
    birth_year: 1260,
    death_year: 1328,
    field: 'Mystical Theology',
    biography_notes: 'Dominican thinker central to apophatic and contemplative traditions.',
    active_period: 'Late medieval period',
  },
  {
    name: 'William James',
    birth_year: 1842,
    death_year: 1910,
    field: 'Psychology of Religion',
    biography_notes: 'Pragmatist psychologist who theorized religious experience from first-person reports.',
    active_period: 'Late 19th to early 20th century',
  },
  {
    name: 'Carl Gustav Jung',
    birth_year: 1875,
    death_year: 1961,
    field: 'Analytical Psychology',
    biography_notes: 'Depth psychologist known for archetypes, symbols, and individuation.',
    active_period: 'Early to mid 20th century',
  },
  {
    name: 'Rudolf Otto',
    birth_year: 1869,
    death_year: 1937,
    field: 'Phenomenology of Religion',
    biography_notes: 'Developed the modern category of the numinous.',
    active_period: 'Early 20th century',
  },
  {
    name: 'Georges Bataille',
    birth_year: 1897,
    death_year: 1962,
    field: 'Philosophy and Religious Studies',
    biography_notes: 'Explored transgression, sacrifice, eroticism, and excess.',
    active_period: 'Mid 20th century',
  },
  {
    name: 'Simone Weil',
    birth_year: 1906,
    death_year: 1943,
    field: 'Philosophy of Religion',
    biography_notes: 'Wrote on attention, affliction, and decreation.',
    active_period: 'Mid 20th century',
  },
  {
    name: 'Michel de Certeau',
    birth_year: 1925,
    death_year: 1986,
    field: 'Religious History and Psychoanalysis',
    biography_notes: 'Historian of mysticism and theorist of everyday practice.',
    active_period: 'Late 20th century',
  },
  {
    name: 'Julia Kristeva',
    birth_year: 1941,
    death_year: null,
    field: 'Psychoanalysis and Cultural Theory',
    biography_notes: 'Developed theories of abjection, language, and religious imagination.',
    active_period: 'Contemporary',
  },
]

export const ANCIENT_PHILOSOPHERS = [
  {
    name: 'Plotinus',
    birth_year: 204,
    death_year: 270,
    field: 'Neoplatonism',
    biography_notes: 'Meditated on emanation and return, influencing later mystical traditions.',
    active_period: '3rd century',
  },
  {
    name: 'Evagrius Ponticus',
    birth_year: 345,
    death_year: 399,
    field: 'Ascetic Theology',
    biography_notes: 'Early Christian writer on contemplation, passions, and spiritual practices.',
    active_period: '4th century',
  },
  {
    name: 'Augustine of Hippo',
    birth_year: 354,
    death_year: 430,
    field: 'Philosophical Theology',
    biography_notes: 'Shaped Western accounts of interiority, desire, and conversion.',
    active_period: 'Late 4th to early 5th century',
  },
]

export const ENLIGHTENMENT_THINKERS = [
  {
    name: 'Blaise Pascal',
    birth_year: 1623,
    death_year: 1662,
    field: 'Philosophy of Religion',
    biography_notes: 'Combined mathematical reasoning with existential and theological reflection.',
    active_period: '17th century',
  },
  {
    name: 'Baruch Spinoza',
    birth_year: 1632,
    death_year: 1677,
    field: 'Philosophy',
    biography_notes: 'Offered an immanent account of God, nature, and affect.',
    active_period: '17th century',
  },
  {
    name: 'Friedrich Schleiermacher',
    birth_year: 1768,
    death_year: 1834,
    field: 'Theology and Hermeneutics',
    biography_notes: 'Defined religion in terms of feeling and dependence.',
    active_period: 'Late 18th to early 19th century',
  },
  {
    name: 'Soren Kierkegaard',
    birth_year: 1813,
    death_year: 1855,
    field: 'Existential Theology',
    biography_notes: 'Analyzed anxiety, faith, and inwardness.',
    active_period: '19th century',
  },
]

export const TEST_THINKERS = {
  philosopher1: {
    name: 'Test Researcher 1',
    birth_year: 1880,
    death_year: 1945,
    field: 'Psychology of Religion',
    biography_notes: 'Seed thinker for comparative method tests.',
  },
  philosopher2: {
    name: 'Test Researcher 2',
    birth_year: 1900,
    death_year: 1970,
    field: 'Phenomenology of Religion',
    biography_notes: 'Seed thinker for conceptual contrast tests.',
  },
  philosopher3: {
    name: 'Test Researcher 3',
    birth_year: 1930,
    death_year: null,
    field: 'Psychoanalysis',
    biography_notes: 'Seed thinker for contemporary overlap tests.',
  },
}

// For edge case testing
export const EDGE_CASE_THINKERS = {
  noDeathYear: {
    name: 'Active Psychoanalytic Theorist',
    birth_year: 1941,
    death_year: null,
    field: 'Psychoanalysis and Religion',
  },
  noBirthYear: {
    name: 'Anonymous Medieval Commentator',
    birth_year: null,
    death_year: 1400,
    field: 'Mystical Theology',
  },
  noDates: {
    name: 'Undated Ritual Theorist',
    birth_year: null,
    death_year: null,
    field: 'Comparative Religion',
  },
  specialCharacters: {
    name: "Jacques Lacan (Seminar XI)",
    birth_year: 1901,
    death_year: 1981,
    field: 'Psychoanalysis and Theology',
  },
  longName: {
    name: 'Interdisciplinary Candidate in Philosophy Psychology and Religious Studies Working on Eckhart Bataille and Mysticism',
    birth_year: 1992,
    death_year: null,
    field: 'Interdisciplinary Religious Studies',
  },
}
