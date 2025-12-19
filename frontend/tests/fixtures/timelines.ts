// Pre-defined timeline data for tests
export const TEST_TIMELINES = {
  germanIdealism: {
    name: 'German Idealism',
    description: 'Timeline covering the development of German Idealism from Kant to Hegel.',
    start_year: 1724,
    end_year: 1900,
  },
  enlightenment: {
    name: 'The Enlightenment',
    description: 'The Age of Enlightenment in Europe.',
    start_year: 1650,
    end_year: 1800,
  },
  ancientGreece: {
    name: 'Ancient Greek Philosophy',
    description: 'Philosophy in Ancient Greece.',
    start_year: -500,
    end_year: -200,
  },
  twentiethCentury: {
    name: '20th Century Philosophy',
    description: 'Major philosophical movements of the 20th century.',
    start_year: 1900,
    end_year: 2000,
  },
  continental: {
    name: 'Continental Philosophy',
    description: 'Continental philosophical tradition.',
    start_year: 1800,
    end_year: 2000,
  },
  analytic: {
    name: 'Analytic Philosophy',
    description: 'Analytic philosophical tradition.',
    start_year: 1879,
    end_year: 2000,
  },
}

export const EDGE_CASE_TIMELINES = {
  noDescription: {
    name: 'Minimal Timeline',
    description: null,
    start_year: 1800,
    end_year: 1900,
  },
  noYears: {
    name: 'Undated Timeline',
    description: 'A timeline without specific years.',
    start_year: null,
    end_year: null,
  },
  singleYear: {
    name: 'Single Year Timeline',
    description: 'A timeline spanning just one year.',
    start_year: 1789,
    end_year: 1789,
  },
  longRange: {
    name: 'Long Range Timeline',
    description: 'A timeline spanning thousands of years.',
    start_year: -3000,
    end_year: 2000,
  },
  specialCharacters: {
    name: 'Philosophy & Religion (1500-1800)',
    description: "Timeline with special chars: <script>, 'quotes', \"double quotes\"",
    start_year: 1500,
    end_year: 1800,
  },
}
