export type APFrameworkUnit = {
  id: string;
  title: string;
  sections: string[];
};

export type APCourseFramework = {
  course: string;
  units: APFrameworkUnit[];
};

const makeUnits = (titles: string[]): APFrameworkUnit[] =>
  titles.map((title, index) => ({
    id: `ap-unit-${index + 1}`,
    title,
    sections: [],
  }));

export const AP_COURSE_FRAMEWORKS: Record<string, APCourseFramework> = {
  'AP Biology': {
    course: 'AP Biology',
    units: makeUnits([
      'Unit 1: Chemistry of Life',
      'Unit 2: Cell Structure and Function',
      'Unit 3: Cellular Energetics',
      'Unit 4: Cell Communication and Cell Cycle',
      'Unit 5: Heredity',
      'Unit 6: Gene Expression and Regulation',
      'Unit 7: Natural Selection',
      'Unit 8: Ecology',
    ]),
  },
  'AP Chemistry': {
    course: 'AP Chemistry',
    units: makeUnits([
      'Unit 1: Atomic Structure and Properties',
      'Unit 2: Molecular and Ionic Compound Structure and Properties',
      'Unit 3: Intermolecular Forces and Properties',
      'Unit 4: Chemical Reactions',
      'Unit 5: Kinetics',
      'Unit 6: Thermodynamics',
      'Unit 7: Equilibrium',
      'Unit 8: Acids and Bases',
      'Unit 9: Applications of Thermodynamics',
    ]),
  },
  'AP Physics 1': {
    course: 'AP Physics 1',
    units: makeUnits([
      'Unit 1: Kinematics',
      'Unit 2: Force and Translational Dynamics',
      'Unit 3: Work, Energy, and Power',
      'Unit 4: Linear Momentum',
      'Unit 5: Torque and Rotational Dynamics',
      'Unit 6: Energy and Momentum of Rotating Systems',
      'Unit 7: Oscillations',
      'Unit 8: Fluids',
    ]),
  },
  'AP Physics 2': {
    course: 'AP Physics 2',
    units: makeUnits([
      'Unit 1: Thermodynamics',
      'Unit 2: Electric Force, Field, and Potential',
      'Unit 3: Electric Circuits',
      'Unit 4: Magnetism and Electromagnetic Induction',
      'Unit 5: Geometric and Physical Optics',
      'Unit 6: Quantum, Atomic, and Nuclear Physics',
    ]),
  },
  'AP Physics C: Mechanics': {
    course: 'AP Physics C: Mechanics',
    units: makeUnits([
      'Unit 1: Kinematics',
      'Unit 2: Newtons Laws of Motion',
      'Unit 3: Work, Energy, and Power',
      'Unit 4: Systems of Particles and Linear Momentum',
      'Unit 5: Rotation',
      'Unit 6: Oscillations',
      'Unit 7: Gravitation',
    ]),
  },
  'AP Physics C: E&M': {
    course: 'AP Physics C: Electricity and Magnetism',
    units: makeUnits([
      'Unit 1: Electrostatics',
      'Unit 2: Conductors, Capacitors, and Dielectrics',
      'Unit 3: Electric Circuits',
      'Unit 4: Magnetic Fields',
      'Unit 5: Electromagnetism',
    ]),
  },
  'AP Calculus AB': {
    course: 'AP Calculus AB',
    units: makeUnits([
      'Unit 1: Limits and Continuity',
      'Unit 2: Differentiation: Definition and Fundamental Properties',
      'Unit 3: Differentiation: Composite, Implicit, and Inverse Functions',
      'Unit 4: Contextual Applications of Differentiation',
      'Unit 5: Analytical Applications of Differentiation',
      'Unit 6: Integration and Accumulation of Change',
      'Unit 7: Differential Equations',
      'Unit 8: Applications of Integration',
    ]),
  },
  'AP Calculus BC': {
    course: 'AP Calculus BC',
    units: makeUnits([
      'Unit 1: Limits and Continuity',
      'Unit 2: Differentiation: Definition and Fundamental Properties',
      'Unit 3: Differentiation: Composite, Implicit, and Inverse Functions',
      'Unit 4: Contextual Applications of Differentiation',
      'Unit 5: Analytical Applications of Differentiation',
      'Unit 6: Integration and Accumulation of Change',
      'Unit 7: Differential Equations',
      'Unit 8: Applications of Integration',
      'Unit 9: Parametric Equations, Polar Coordinates, and Vector-Valued Functions',
      'Unit 10: Infinite Sequences and Series',
    ]),
  },
  'AP Statistics': {
    course: 'AP Statistics',
    units: makeUnits([
      'Unit 1: Exploring One-Variable Data',
      'Unit 2: Exploring Two-Variable Data',
      'Unit 3: Collecting Data',
      'Unit 4: Probability, Random Variables, and Probability Distributions',
      'Unit 5: Sampling Distributions',
      'Unit 6: Inference for Categorical Data: Proportions',
      'Unit 7: Inference for Quantitative Data: Means',
      'Unit 8: Inference for Categorical Data: Chi-Square',
      'Unit 9: Inference for Quantitative Data: Slopes',
    ]),
  },
  'AP Computer Science A': {
    course: 'AP Computer Science A',
    units: makeUnits([
      'Unit 1: Primitive Types',
      'Unit 2: Using Objects',
      'Unit 3: Boolean Expressions and if Statements',
      'Unit 4: Iteration',
      'Unit 5: Writing Classes',
      'Unit 6: Array',
      'Unit 7: ArrayList',
      'Unit 8: 2D Array',
      'Unit 9: Inheritance',
      'Unit 10: Recursion',
    ]),
  },
  'AP Computer Science Principles': {
    course: 'AP Computer Science Principles',
    units: makeUnits([
      'Unit 1: Creative Development',
      'Unit 2: Data',
      'Unit 3: Algorithms and Programming',
      'Unit 4: Computer Systems and Networks',
      'Unit 5: Impact of Computing',
    ]),
  },
  'AP English Language': {
    course: 'AP English Language and Composition',
    units: makeUnits([
      'Unit 1: Claims, Evidence, and Commentary',
      'Unit 2: Rhetorical Situation and Audience',
      'Unit 3: Rhetorical Analysis',
      'Unit 4: Line of Reasoning',
      'Unit 5: Developing Commentary',
      'Unit 6: Argumentation',
      'Unit 7: Synthesis',
      'Unit 8: Style and Rhetorical Choices',
      'Unit 9: Exam Synthesis and Argument Practice',
    ]),
  },
  'AP English Literature': {
    course: 'AP English Literature and Composition',
    units: makeUnits([
      'Unit 1: Short Fiction I',
      'Unit 2: Poetry I',
      'Unit 3: Longer Fiction or Drama I',
      'Unit 4: Short Fiction II',
      'Unit 5: Poetry II',
      'Unit 6: Longer Fiction or Drama II',
      'Unit 7: Short Fiction III',
      'Unit 8: Poetry III',
      'Unit 9: Longer Fiction or Drama III',
    ]),
  },
  'AP US History': {
    course: 'AP United States History',
    units: makeUnits([
      'Period 1: 1491-1607',
      'Period 2: 1607-1754',
      'Period 3: 1754-1800',
      'Period 4: 1800-1848',
      'Period 5: 1844-1877',
      'Period 6: 1865-1898',
      'Period 7: 1890-1945',
      'Period 8: 1945-1980',
      'Period 9: 1980-Present',
    ]),
  },
  'AP World History': {
    course: 'AP World History: Modern',
    units: makeUnits([
      'Unit 1: The Global Tapestry',
      'Unit 2: Networks of Exchange',
      'Unit 3: Land-Based Empires',
      'Unit 4: Transoceanic Interconnections',
      'Unit 5: Revolutions',
      'Unit 6: Consequences of Industrialization',
      'Unit 7: Global Conflict',
      'Unit 8: Cold War and Decolonization',
      'Unit 9: Globalization',
    ]),
  },
  'AP European History': {
    course: 'AP European History',
    units: makeUnits([
      'Unit 1: Renaissance and Exploration',
      'Unit 2: Age of Reformation',
      'Unit 3: Absolutism and Constitutionalism',
      'Unit 4: Scientific, Philosophical, and Political Developments',
      'Unit 5: Conflict, Crisis, and Reaction in the Late 18th Century',
      'Unit 6: Industrialization and Its Effects',
      'Unit 7: 19th-Century Perspectives and Political Developments',
      'Unit 8: 20th-Century Global Conflicts',
      'Unit 9: Cold War and Contemporary Europe',
    ]),
  },
  'AP Government': {
    course: 'AP United States Government and Politics',
    units: makeUnits([
      'Unit 1: Foundations of American Democracy',
      'Unit 2: Interactions Among Branches of Government',
      'Unit 3: Civil Liberties and Civil Rights',
      'Unit 4: American Political Ideologies and Beliefs',
      'Unit 5: Political Participation',
    ]),
  },
  'AP Macroeconomics': {
    course: 'AP Macroeconomics',
    units: makeUnits([
      'Unit 1: Basic Economic Concepts',
      'Unit 2: Economic Indicators and the Business Cycle',
      'Unit 3: National Income and Price Determination',
      'Unit 4: Financial Sector',
      'Unit 5: Long-Run Consequences of Stabilization Policies',
      'Unit 6: Open Economy: International Trade and Finance',
    ]),
  },
  'AP Microeconomics': {
    course: 'AP Microeconomics',
    units: makeUnits([
      'Unit 1: Basic Economic Concepts',
      'Unit 2: Supply and Demand',
      'Unit 3: Production, Cost, and the Perfect Competition Model',
      'Unit 4: Imperfect Competition',
      'Unit 5: Factor Markets',
      'Unit 6: Market Failure and the Role of Government',
    ]),
  },
  'AP Psychology': {
    course: 'AP Psychology',
    units: makeUnits([
      'Unit 1: Biological Bases of Behavior',
      'Unit 2: Cognition',
      'Unit 3: Development and Learning',
      'Unit 4: Social Psychology and Personality',
      'Unit 5: Mental and Physical Health',
    ]),
  },
  'AP Environmental Science': {
    course: 'AP Environmental Science',
    units: makeUnits([
      'Unit 1: The Living World: Ecosystems',
      'Unit 2: The Living World: Biodiversity',
      'Unit 3: Populations',
      'Unit 4: Earth Systems and Resources',
      'Unit 5: Land and Water Use',
      'Unit 6: Energy Resources and Consumption',
      'Unit 7: Atmospheric Pollution',
      'Unit 8: Aquatic and Terrestrial Pollution',
      'Unit 9: Global Change',
    ]),
  },
  'AP Human Geography': {
    course: 'AP Human Geography',
    units: makeUnits([
      'Unit 1: Thinking Geographically',
      'Unit 2: Population and Migration Patterns and Processes',
      'Unit 3: Cultural Patterns and Processes',
      'Unit 4: Political Patterns and Processes',
      'Unit 5: Agriculture and Rural Land-Use Patterns and Processes',
      'Unit 6: Cities and Urban Land-Use Patterns and Processes',
      'Unit 7: Industrial and Economic Development Patterns and Processes',
    ]),
  },
  'AP Spanish': {
    course: 'AP Spanish Language and Culture',
    units: makeUnits([
      'Theme 1: Families and Communities',
      'Theme 2: Personal and Public Identities',
      'Theme 3: Beauty and Aesthetics',
      'Theme 4: Science and Technology',
      'Theme 5: Contemporary Life',
      'Theme 6: Global Challenges',
    ]),
  },
  'AP French': {
    course: 'AP French Language and Culture',
    units: makeUnits([
      'Theme 1: Families and Communities',
      'Theme 2: Personal and Public Identities',
      'Theme 3: Beauty and Aesthetics',
      'Theme 4: Science and Technology',
      'Theme 5: Contemporary Life',
      'Theme 6: Global Challenges',
    ]),
  },
  'AP Art History': {
    course: 'AP Art History',
    units: makeUnits([
      'Unit 1: Global Prehistory, 30000-500 BCE',
      'Unit 2: Ancient Mediterranean, 3500 BCE-300 CE',
      'Unit 3: Early Europe and Colonial Americas, 200-1750 CE',
      'Unit 4: Later Europe and Americas, 1750-1980 CE',
      'Unit 5: Indigenous Americas, 1000 BCE-1980 CE',
      'Unit 6: Africa, 1100-1980 CE',
      'Unit 7: West and Central Asia, 500 BCE-1980 CE',
      'Unit 8: South, East, and Southeast Asia, 300 BCE-1980 CE',
      'Unit 9: The Pacific, 700-1980 CE',
      'Unit 10: Global Contemporary, 1980 CE-Present',
    ]),
  },
};

export function getAPCourseFramework(courseTitle: string): APCourseFramework | null {
  const normalizedTitle = courseTitle.trim().toLowerCase();
  const directMatch = Object.entries(AP_COURSE_FRAMEWORKS).find(
    ([key, framework]) =>
      key.toLowerCase() === normalizedTitle ||
      framework.course.toLowerCase() === normalizedTitle
  );
  if (directMatch) return directMatch[1];

  return Object.values(AP_COURSE_FRAMEWORKS).find((framework) => {
    const key = framework.course.toLowerCase();
    return normalizedTitle.includes(key) || key.includes(normalizedTitle);
  }) || null;
}
