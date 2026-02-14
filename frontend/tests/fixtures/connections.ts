// Pre-defined connection data for tests
export const TEST_CONNECTIONS = {
  kantInfluencedHegel: {
    connection_type: 'influenced',
    strength: 4,
    notes: 'Eckhartian detachment prefigures later analyses of interior religious experience.',
    bidirectional: false,
  },
  hegelInfluencedMarx: {
    connection_type: 'influenced',
    strength: 4,
    notes: 'James institutionalized first-person accounts of religion in modern psychology.',
    bidirectional: false,
  },
  marxCritiquedHegel: {
    connection_type: 'built_upon',
    strength: 4,
    notes: 'Jung expanded James with symbolic and archetypal interpretation.',
    bidirectional: false,
  },
  nietzscheCritiquedKant: {
    connection_type: 'critiqued',
    strength: 4,
    notes: 'Bataille critiques Otto by foregrounding transgression and excess.',
    bidirectional: false,
  },
  heideggerBuiltOnNietzsche: {
    connection_type: 'built_upon',
    strength: 3,
    notes: 'De Certeau historicizes mystical discourse with psychoanalytic tools.',
    bidirectional: false,
  },
  arendtBuiltOnHeidegger: {
    connection_type: 'synthesized',
    strength: 3,
    notes: 'Kristeva combines psychoanalytic theory with religious semiotics.',
    bidirectional: false,
  },
  foucaultSynthesizedNietzscheMarx: {
    connection_type: 'synthesized',
    strength: 4,
    notes: 'Simone Weil synthesizes ascetic theology with critiques of force and modernity.',
    bidirectional: false,
  },
}

export const CONNECTION_TYPES = {
  influenced: {
    label: 'Influenced',
    description: 'Genealogical or conceptual influence across thinkers.',
    color: '#4ECDC4',
  },
  critiqued: {
    label: 'Critiqued',
    description: 'Critical engagement that challenges another framework.',
    color: '#FF6B6B',
  },
  built_upon: {
    label: 'Built Upon',
    description: 'Extends another thinker\'s method or conceptual language.',
    color: '#45B7D1',
  },
  synthesized: {
    label: 'Synthesized',
    description: 'Combines strands from multiple traditions into a new model.',
    color: '#96CEB4',
  },
}

export const EDGE_CASE_CONNECTIONS = {
  bidirectional: {
    connection_type: 'influenced',
    strength: 3,
    notes: 'Mutual seminar exchange across two fields',
    bidirectional: true,
  },
  minStrength: {
    connection_type: 'influenced',
    strength: 1,
    notes: 'Minimal connection',
    bidirectional: false,
  },
  maxStrength: {
    connection_type: 'influenced',
    strength: 5,
    notes: 'Maximum strength genealogical connection',
    bidirectional: false,
  },
  noNotes: {
    connection_type: 'critiqued',
    strength: 3,
    notes: null,
    bidirectional: false,
  },
  longNotes: {
    connection_type: 'built_upon',
    strength: 4,
    notes: 'This is a very long note describing a dissertation-level conceptual bridge between philosophy, psychology, and religious studies. '.repeat(10),
    bidirectional: false,
  },
}
