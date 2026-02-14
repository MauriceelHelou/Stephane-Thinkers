// Pre-defined timeline data for tests
export const TEST_TIMELINES = {
  germanIdealism: {
    name: 'Mysticism and Subject Formation',
    description: 'From Meister Eckhart to late 20th-century theories of interiority.',
    start_year: 1260,
    end_year: 1986,
  },
  enlightenment: {
    name: 'Psychology of Religion Seminar Arc',
    description: 'Comparative sequence centered on James, Jung, Otto, and Bataille.',
    start_year: 1842,
    end_year: 1962,
  },
  ancientGreece: {
    name: 'Late Antique and Medieval Mysticism',
    description: 'Conceptual groundwork for apophatic thought and ascetic psychology.',
    start_year: 200,
    end_year: 1400,
  },
  twentiethCentury: {
    name: '20th Century Sacred and Transgression',
    description: 'Accounts of limit-experience, abjection, and ritual in modernity.',
    start_year: 1900,
    end_year: 2005,
  },
  continental: {
    name: 'Continental Theory of Religion',
    description: 'French and German trajectories in theology, psychoanalysis, and culture.',
    start_year: 1800,
    end_year: 2005,
  },
  analytic: {
    name: 'Philosophy Mind and Religious Experience',
    description: 'Intersections between psychology, phenomenology, and philosophy of religion.',
    start_year: 1840,
    end_year: 2020,
  },
}

export const EDGE_CASE_TIMELINES = {
  noDescription: {
    name: 'Minimal Dissertation Track',
    description: null,
    start_year: 1900,
    end_year: 1910,
  },
  noYears: {
    name: 'Undated Reading Cluster',
    description: 'A thematic timeline without strict year bounds.',
    start_year: null,
    end_year: null,
  },
  singleYear: {
    name: 'Single Year Colloquium',
    description: 'A one-year milestone timeline.',
    start_year: 1957,
    end_year: 1957,
  },
  longRange: {
    name: 'Long Range Sacred Histories',
    description: 'A long-range timeline across major shifts in religious thought.',
    start_year: 200,
    end_year: 2020,
  },
  specialCharacters: {
    name: 'Mysticism & Psychoanalysis (1900-1962)',
    description: "Timeline with special chars: <script>, 'notes', \"citations\"",
    start_year: 1900,
    end_year: 1962,
  },
}
