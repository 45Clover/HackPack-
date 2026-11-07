// Owner: Job data (@45Clover). Turns a feed's free-text location into city + remote + "is it in Canada".

const CITIES = [
  "Calgary", "Edmonton", "Vancouver", "Burnaby", "Victoria", "Toronto", "Mississauga", "Waterloo",
  "Kitchener", "Ottawa", "Montreal", "Quebec City", "Winnipeg", "Saskatoon", "Regina", "Halifax",
];
// Full names only: short codes like "CA" (California) and "ON" (the word "on") give false matches.
const CANADA = /canada|alberta|british columbia|ontario|quebec|manitoba|saskatchewan|nova scotia|new brunswick/i;

export function parseLocation(text: string): { city: string | null; remote: boolean; canada: boolean } {
  const t = text.normalize("NFD").replace(/[̀-ͯ]/g, ""); // Montréal → Montreal
  const city = CITIES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(t)) ?? null;
  const canada = city !== null || CANADA.test(t);
  return { city, remote: canada && /remote/i.test(t), canada };
}
