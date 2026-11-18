// Best-effort country detection from free-text job locations, plus country -> region.
import type { Region } from "./taxonomy";

// The third field is the oil & gas region grouping this table came from; regions for this
// stream are derived by regionOf() below.
type C = [iso: string, name: string, group: string, aliases?: string[], cities?: string[]];

const COUNTRIES: C[] = [
  // GCC
  ["AE", "United Arab Emirates", "GCC", ["UAE", "U.A.E", "Emirates"], ["Abu Dhabi", "Dubai", "Sharjah", "Ruwais", "Fujairah", "Ras Al Khaimah", "Das Island", "Jebel Ali", "Musaffah", "Mussafah", "Habshan", "Ajman", "Zirku"]],
  ["SA", "Saudi Arabia", "GCC", ["KSA", "Kingdom of Saudi Arabia"], ["Dhahran", "Riyadh", "Jubail", "Al Khobar", "Khobar", "Dammam", "Jeddah", "Yanbu", "Ras Tanura", "Abqaiq", "Rabigh", "Jazan", "Udhailiyah", "NEOM", "Al Jubail"]],
  ["QA", "Qatar", "GCC", [], ["Doha", "Ras Laffan", "Mesaieed", "Dukhan", "Al Khor"]],
  ["KW", "Kuwait", "GCC", [], ["Ahmadi", "Kuwait City", "Mina Al Ahmadi", "Al Zour", "Shuaiba"]],
  ["OM", "Oman", "GCC", ["Sultanate of Oman"], ["Muscat", "Sohar", "Duqm", "Sur", "Salalah", "Fahud", "Marmul", "Nimr"]],
  ["BH", "Bahrain", "GCC", ["Kingdom of Bahrain"], ["Manama", "Sitra", "Awali"]],
  // MENA
  ["IQ", "Iraq", "Middle East & North Africa", [], ["Basra", "Basrah", "Baghdad", "Erbil", "Kirkuk", "Sulaymaniyah"]],
  ["EG", "Egypt", "Middle East & North Africa", [], ["Cairo", "Alexandria", "Suez", "Port Said"]],
  ["DZ", "Algeria", "Middle East & North Africa", [], ["Algiers", "Hassi Messaoud", "Oran"]],
  ["LY", "Libya", "Middle East & North Africa", [], ["Tripoli", "Benghazi"]],
  ["TN", "Tunisia", "Middle East & North Africa", [], ["Tunis"]],
  ["MA", "Morocco", "Middle East & North Africa", [], ["Casablanca", "Rabat"]],
  ["JO", "Jordan", "Middle East & North Africa", [], ["Amman"]],
  ["LB", "Lebanon", "Middle East & North Africa", [], ["Beirut"]],
  ["IL", "Israel", "Middle East & North Africa", [], ["Rehovot", "Jerusalem", "Tel Aviv", "Haifa"]],
  ["TR", "Turkey", "Europe", ["Türkiye", "Turkiye"], ["Istanbul", "Ankara", "Izmir"]],
  ["AZ", "Azerbaijan", "Europe", [], ["Baku"]],
  ["KZ", "Kazakhstan", "Asia-Pacific", [], ["Atyrau", "Aktau", "Almaty", "Astana", "Aksai", "Aksay"]],
  // Europe
  ["GB", "United Kingdom", "Europe", ["UK", "U.K.", "Great Britain", "England", "Scotland", "Wales"], ["Bristol", "Oxford", "Cambridge", "Edinburgh", "Dundee", "Cardiff", "Exeter", "Brighton", "Falmer", "Norwich", "Hinxton", "Didcot", "Harwell", "Sheffield", "Leeds", "Nottingham", "Coventry", "Southampton", "Liverpool", "York", "Bath", "Leicester", "St Andrews", "Aberdeen", "Belfast", "Stevenage", "Macclesfield", "Alderley Park", "Abingdon", "Babraham", "Sandwich", "London", "Aberdeen", "Manchester", "Glasgow", "Edinburgh", "Reading", "Leatherhead", "Warrington", "Sunbury", "Staines", "Newcastle", "Teesside", "Bristol", "Birmingham", "Leeds", "Woking", "Milton Keynes"]],
  ["NO", "Norway", "Europe", [], ["Stavanger", "Oslo", "Bergen", "Fornebu", "Trondheim", "Sandnes", "Haugesund", "Kristiansand", "Lysaker"]],
  ["NL", "Netherlands", "Europe", ["The Netherlands", "Holland"], ["Leiden", "Nijmegen", "Utrecht", "Maastricht", "The Hague", "Den Haag", "Amsterdam", "Rotterdam", "Schiedam", "Leiden", "Zoetermeer", "Groningen", "Pernis", "Moerdijk"]],
  ["IT", "Italy", "Europe", ["Italia"], ["Trento", "Padua", "Padova", "Pisa", "Naples", "Turin", "Torino", "Milan", "Milano", "San Donato", "Rome", "Roma", "Ravenna", "Genoa", "Genova"]],
  ["FR", "France", "Europe", [], ["Strasbourg", "Grenoble", "Montpellier", "Toulouse", "Bordeaux", "Marseille", "Villejuif", "Gif-sur-Yvette", "Illkirch", "Paris", "Pau", "Nanterre", "Courbevoie", "La Défense", "Lyon", "Marseille"]],
  ["DE", "Germany", "Europe", ["Deutschland"], ["Heidelberg", "Martinsried", "Göttingen", "Gottingen", "Tübingen", "Tubingen", "Bonn", "Dresden", "Leipzig", "Freiburg", "Mainz", "Magdeburg", "Würzburg", "Planegg", "Hamburg", "Munich", "München", "Frankfurt", "Berlin", "Essen", "Kassel", "Erlangen", "Düsseldorf", "Cologne", "Köln"]],
  ["ES", "Spain", "Europe", ["España"], ["Valencia", "Seville", "Sevilla", "Salamanca", "Madrid", "Barcelona", "Tarragona", "Bilbao"]],
  ["PT", "Portugal", "Europe", [], ["Oeiras", "Coimbra", "Lisbon", "Lisboa", "Porto", "Sines"]],
  ["DK", "Denmark", "Europe", [], ["Odense", "Bagsværd", "Copenhagen", "Esbjerg", "Aarhus", "Odense"]],
  ["SE", "Sweden", "Europe", [], ["Solna", "Uppsala", "Lund", "Umeå", "Stockholm", "Gothenburg", "Göteborg"]],
  ["FI", "Finland", "Europe", [], ["Helsinki", "Porvoo", "Espoo"]],
  ["BE", "Belgium", "Europe", [], ["Leuven", "Ghent", "Gent", "Liège", "Brussels", "Antwerp", "Antwerpen"]],
  ["AT", "Austria", "Europe", [], ["Klosterneuburg", "Innsbruck", "Graz", "Vienna", "Wien"]],
  ["CH", "Switzerland", "Europe", [], ["Lausanne", "Bern", "Zurich", "Zürich", "Geneva", "Basel", "Baden"]],
  ["IE", "Ireland", "Europe", [], ["Dublin", "Cork"]],
  ["PL", "Poland", "Europe", [], ["Warsaw", "Krakow", "Kraków", "Gdansk", "Wroclaw"]],
  ["RO", "Romania", "Europe", [], ["Bucharest", "Ploiesti"]],
  ["GR", "Greece", "Europe", [], ["Athens"]],
  ["CY", "Cyprus", "Europe", [], ["Limassol", "Nicosia"]],
  ["HU", "Hungary", "Europe", [], ["Budapest"]],
  ["CZ", "Czech Republic", "Europe", ["Czechia"], ["Prague", "Brno"]],
  // North America
  ["US", "United States", "North America", ["USA", "U.S.", "United States of America", "Alabama", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "Wisconsin", "Wyoming", "Alaska", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Rhode Island", "South Carolina", "South Dakota", "West Virginia", "Gulf of Mexico"], ["Boston", "Cambridge, MA", "Durham, NC", "Chapel Hill", "Baltimore", "Bethesda", "Rockville", "New Haven", "Providence", "Philadelphia", "Ann Arbor", "Madison", "Minneapolis", "St. Louis", "Saint Louis", "Nashville", "Atlanta", "Seattle", "San Francisco", "South San Francisco", "La Jolla", "San Diego", "Palo Alto", "Stanford", "Berkeley", "Los Angeles", "Ashburn", "Cold Spring Harbor", "Bar Harbor", "Ithaca", "Princeton", "Salt Lake City", "Iowa City", "Columbus", "Cleveland", "Cincinnati", "Memphis", "Hanover, NH", "Worcester", "Waltham", "Lexington, MA", "Somerville", "Charlottesville", "Rochester, MN", "Rochester, NY", "Bronx", "Brooklyn", "Manhattan", "Aurora, CO", "Portland, OR", "Gainesville", "Miami", "Jupiter", "Kansas City", "Indianapolis", "Chicago", "Evanston", "Detroit", "Dallas", "Hanover", "Woods Hole", "Emeryville", "Redwood City", "Thousand Oaks", "Indianapolis", "Raleigh", "Research Triangle Park", "Morrisville", "Houston", "The Woodlands", "Katy", "Midland", "Denver", "New Orleans", "Baton Rouge", "Lake Charles", "Anchorage", "Bakersfield", "Tulsa", "Oklahoma City", "Dallas", "Irving", "San Ramon", "Pittsburgh", "Chicago", "New York", "Pasadena", "Port Arthur", "Beaumont", "Corpus Christi", "Lafayette", "Sugar Land", "Galveston", "Covington"]],
  ["CA", "Canada", "North America", ["Alberta", "Newfoundland", "British Columbia", "Saskatchewan", "Ontario"], ["Calgary", "Edmonton", "Fort McMurray", "Vancouver", "Toronto", "St. John's", "Montreal", "Regina"]],
  ["MX", "Mexico", "Latin America", ["México"], ["Mexico City", "Ciudad del Carmen", "Villahermosa", "Monterrey", "Tampico", "Veracruz"]],
  // Latin America
  ["BR", "Brazil", "Latin America", ["Brasil"], ["Rio de Janeiro", "Macaé", "Macae", "São Paulo", "Sao Paulo", "Salvador", "Niterói", "Niteroi", "Vitória"]],
  ["AR", "Argentina", "Latin America", [], ["Buenos Aires", "Neuquén", "Neuquen", "Comodoro Rivadavia"]],
  ["CO", "Colombia", "Latin America", [], ["Bogotá", "Bogota", "Barrancabermeja", "Cartagena"]],
  ["GY", "Guyana", "Latin America", [], ["Georgetown"]],
  ["SR", "Suriname", "Latin America", [], ["Paramaribo"]],
  ["TT", "Trinidad and Tobago", "Latin America", ["Trinidad"], ["Port of Spain", "Point Lisas"]],
  ["VE", "Venezuela", "Latin America", [], ["Caracas"]],
  ["EC", "Ecuador", "Latin America", [], ["Quito"]],
  ["PE", "Peru", "Latin America", [], ["Lima"]],
  ["CL", "Chile", "Latin America", [], ["Santiago"]],
  // Sub-Saharan Africa
  ["NG", "Nigeria", "Sub-Saharan Africa", [], ["Lagos", "Port Harcourt", "Abuja", "Warri", "Bonny"]],
  ["AO", "Angola", "Sub-Saharan Africa", [], ["Luanda", "Soyo"]],
  ["GH", "Ghana", "Sub-Saharan Africa", [], ["Accra", "Takoradi"]],
  ["MZ", "Mozambique", "Sub-Saharan Africa", [], ["Maputo", "Pemba"]],
  ["TZ", "Tanzania", "Sub-Saharan Africa", [], ["Dar es Salaam"]],
  ["KE", "Kenya", "Sub-Saharan Africa", [], ["Nairobi", "Mombasa"]],
  ["UG", "Uganda", "Sub-Saharan Africa", [], ["Kampala"]],
  ["ZA", "South Africa", "Sub-Saharan Africa", [], ["Johannesburg", "Cape Town", "Durban", "Sasolburg", "Secunda"]],
  ["SN", "Senegal", "Sub-Saharan Africa", [], ["Dakar"]],
  ["CG", "Republic of the Congo", "Sub-Saharan Africa", ["Congo"], ["Pointe-Noire"]],
  ["GA", "Gabon", "Sub-Saharan Africa", [], ["Port-Gentil", "Libreville"]],
  ["CM", "Cameroon", "Sub-Saharan Africa", [], ["Douala"]],
  ["GQ", "Equatorial Guinea", "Sub-Saharan Africa", [], ["Malabo"]],
  ["NA", "Namibia", "Sub-Saharan Africa", [], ["Windhoek", "Walvis Bay"]],
  // India
  ["IN", "India", "India", ["Bharat"], ["Pune", "Hyderabad", "Kolkata", "Mohali", "Bhopal", "Thiruvananthapuram", "Trivandrum", "Tirupati", "Berhampur", "Bhubaneswar", "Lucknow", "Chandigarh", "Faridabad", "Manesar", "Goa", "Vellore", "Manipal", "Mysuru", "Mysore", "Kanpur", "Guwahati", "Indore", "Coimbatore", "Nagpur", "Thane", "Ankleshwar", "Sikkim", "Baddi", "Mumbai", "Navi Mumbai", "New Delhi", "Delhi", "Gurgaon", "Gurugram", "Noida", "Bangalore", "Bengaluru", "Chennai", "Hyderabad", "Pune", "Vadodara", "Baroda", "Jamnagar", "Ahmedabad", "Kolkata", "Dehradun", "Kochi", "Visakhapatnam", "Gandhinagar", "Panipat", "Mathura", "Haldia", "Duliajan"]],
  // Asia-Pacific
  ["MY", "Malaysia", "Asia-Pacific", [], ["Kuala Lumpur", "Miri", "Bintulu", "Kota Kinabalu", "Kerteh", "Johor", "Labuan"]],
  ["SG", "Singapore", "Asia-Pacific", [], []],
  ["ID", "Indonesia", "Asia-Pacific", [], ["Jakarta", "Balikpapan", "Batam", "Surabaya"]],
  ["TH", "Thailand", "Asia-Pacific", [], ["Bangkok", "Rayong", "Sriracha", "Map Ta Phut"]],
  ["VN", "Vietnam", "Asia-Pacific", ["Viet Nam"], ["Hanoi", "Ho Chi Minh", "Vung Tau"]],
  ["PH", "Philippines", "Asia-Pacific", [], ["Manila", "Makati", "Taguig", "Batangas", "Cagayan De Oro"]],
  ["BN", "Brunei", "Asia-Pacific", ["Brunei Darussalam"], ["Seria", "Bandar Seri Begawan"]],
  ["CN", "China", "Asia-Pacific", ["PRC"], ["Beijing", "Shanghai", "Shenzhen", "Tianjin", "Guangzhou", "Huizhou", "Ningbo"]],
  ["HK", "Hong Kong", "Asia-Pacific", [], []],
  ["TW", "Taiwan", "Asia-Pacific", [], ["Taipei"]],
  ["JP", "Japan", "Asia-Pacific", [], ["Tokyo", "Yokohama", "Osaka"]],
  ["KR", "South Korea", "Asia-Pacific", ["Korea", "Republic of Korea"], ["Seoul", "Ulsan", "Geoje", "Busan", "Yeosu"]],
  ["AU", "Australia", "Asia-Pacific", ["AUS"], ["Perth", "Brisbane", "Sydney", "Melbourne", "Adelaide", "Darwin", "Gladstone", "Karratha", "Onslow"]],
  ["NZ", "New Zealand", "Asia-Pacific", [], ["Wellington", "Auckland", "New Plymouth"]],
  ["PG", "Papua New Guinea", "Asia-Pacific", ["PNG"], ["Port Moresby"]],
  ["PK", "Pakistan", "Asia-Pacific", [], ["Karachi", "Islamabad", "Lahore"]],
  ["BD", "Bangladesh", "Asia-Pacific", [], ["Dhaka", "Chittagong"]],
  ["LK", "Sri Lanka", "Asia-Pacific", [], ["Colombo"]],
];

const EUROPE = new Set([
  "NO", "NL", "IT", "FR", "DE", "ES", "PT", "DK", "SE", "FI", "BE", "AT", "CH", "IE", "PL", "RO", "GR",
  "CY", "HU", "CZ", "TR", "AZ",
]);
function regionOf(iso: string): Region {
  if (iso === "US") return "United States";
  if (iso === "GB") return "United Kingdom";
  if (iso === "IN") return "India";
  return EUROPE.has(iso) ? "Europe" : "Other";
}

export const COUNTRY_NAME: Record<string, string> = {};
export const COUNTRY_REGION: Record<string, Region> = {};

const matchers: { re: RegExp; iso: string; len: number }[] = [];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const [iso, name, , aliases = [], cities = []] of COUNTRIES) {
  COUNTRY_NAME[iso] = name;
  COUNTRY_REGION[iso] = regionOf(iso);
  for (const term of [name, ...aliases, ...cities]) {
    // Case-sensitive for short all-caps aliases (UK, USA, KSA) to avoid false hits.
    const flags = term.length <= 4 && term === term.toUpperCase() ? "" : "i";
    matchers.push({ re: new RegExp(`(^|[^\\p{L}])${esc(term)}($|[^\\p{L}])`, `u${flags}`), iso, len: term.length });
  }
}
// Longer terms first so "Kuwait City" wins over generic hits and "Papua New Guinea" over "Guinea".
matchers.sort((a, b) => b.len - a.len);

// Trailing ISO codes like "Houston, TX, US" or "Abu Dhabi, AE".
const TRAILING_ISO = /(?:^|[,\s-])([A-Z]{2})\s*$/;
// US state abbreviations: "City, ST" in ATS output is almost always the US.
const US_STATES = new Set(
  ("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY " +
    "NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY").split(" "),
);

export function detectCountry(location: string | undefined): string | undefined {
  if (!location) return undefined;
  // An explicit trailing code ("Cartagena, MC, ES") beats a city-name guess.
  // Look at comma-separated parts from the end, skipping postcodes ("TX, US, 77056").
  const parts = location.split(/[,;|]/).map((p) => p.trim()).filter((p) => p && !/^\d+$/.test(p));
  const last = parts.at(-1)?.match(TRAILING_ISO)?.[1];
  const byName = matchers.find((m) => m.re.test(location))?.iso;
  if (last && US_STATES.has(last)) {
    // "Bengaluru, IN" / "Toronto, CA": the city agrees with the country reading of the code.
    // "Cambridge, MA" / "Los Angeles, CA": otherwise it's a US state.
    return byName === last ? last : "US";
  }
  if (last && COUNTRY_NAME[last]) return last;
  return byName;
}
