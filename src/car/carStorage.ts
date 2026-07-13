import AsyncStorage from "@react-native-async-storage/async-storage";
import { CarRecord } from "./carTypes";

const STORAGE_KEY = "cars";

/* ⭐ Load all cars */
export async function loadCars(): Promise<CarRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

/* ⭐ Alias for loadCars (UI expects this name) */
export async function getAllCars(): Promise<CarRecord[]> {
  return await loadCars();
}

/* ⭐ Get a single car by ID */
export async function getCarById(id: string): Promise<CarRecord | undefined> {
  const cars = await loadCars();
  return cars.find(c => c.id === id);
}

/* ⭐ Add a new car */
export async function addCar(car: CarRecord) {
  const cars = await loadCars();
  cars.push(car);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cars));
}

/* ⭐ Update a car */
export async function updateCar(id: string, patch: Partial<CarRecord>) {
  const cars = await loadCars();
  const index = cars.findIndex(c => c.id === id);
  if (index === -1) return;

  cars[index] = { ...cars[index], ...patch };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cars));
}

/* ⭐ Delete a car */
export async function deleteCar(id: string) {
  const cars = await loadCars();
  const filtered = cars.filter(c => c.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/* ⭐ Toggle favourite flag */
export async function toggleFavourite(id: string) {
  const cars = await loadCars();
  const index = cars.findIndex(c => c.id === id);
  if (index === -1) return;

  const current = cars[index];
  const updated = { ...current, favourite: !current.favourite };

  cars[index] = updated;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cars));
}
