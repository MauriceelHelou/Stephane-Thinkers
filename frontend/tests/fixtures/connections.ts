// Pre-defined connection data for tests
export const TEST_CONNECTIONS = {
  kantInfluencedHegel: {
    connection_type: 'influenced',
    strength: 5,
    notes: 'Kant\'s critical philosophy was the foundation for Hegel\'s dialectical method.',
    bidirectional: false,
  },
  hegelInfluencedMarx: {
    connection_type: 'influenced',
    strength: 5,
    notes: 'Marx adopted Hegel\'s dialectical method but inverted it materialistically.',
    bidirectional: false,
  },
  marxCritiquedHegel: {
    connection_type: 'critiqued',
    strength: 4,
    notes: 'Marx critiqued Hegel\'s idealism, developing historical materialism.',
    bidirectional: false,
  },
  nietzscheCritiquedKant: {
    connection_type: 'critiqued',
    strength: 4,
    notes: 'Nietzsche critiqued Kant\'s moral philosophy.',
    bidirectional: false,
  },
  heideggerBuiltOnNietzsche: {
    connection_type: 'built_upon',
    strength: 4,
    notes: 'Heidegger engaged extensively with Nietzsche\'s work.',
    bidirectional: false,
  },
  arendtBuiltOnHeidegger: {
    connection_type: 'built_upon',
    strength: 3,
    notes: 'Arendt was a student of Heidegger and built on his phenomenological approach.',
    bidirectional: false,
  },
  foucaultSynthesizedNietzscheMarx: {
    connection_type: 'synthesized',
    strength: 4,
    notes: 'Foucault synthesized elements of both Nietzsche and Marx.',
    bidirectional: false,
  },
}

export const CONNECTION_TYPES = {
  influenced: {
    label: 'Influenced',
    description: 'Direct intellectual influence from one thinker to another.',
    color: '#4ECDC4',
  },
  critiqued: {
    label: 'Critiqued',
    description: 'Critical engagement with another thinker\'s ideas.',
    color: '#FF6B6B',
  },
  built_upon: {
    label: 'Built Upon',
    description: 'Extended or developed another thinker\'s work.',
    color: '#45B7D1',
  },
  synthesized: {
    label: 'Synthesized',
    description: 'Combined ideas from multiple thinkers.',
    color: '#96CEB4',
  },
}

export const EDGE_CASE_CONNECTIONS = {
  bidirectional: {
    connection_type: 'influenced',
    strength: 3,
    notes: 'Mutual intellectual exchange',
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
    notes: 'Maximum strength connection',
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
    notes: 'This is a very long note that describes the connection in great detail. '.repeat(10),
    bidirectional: false,
  },
}
