import AsyncStorage from "@react-native-async-storage/async-storage";
import { CarRecord } from "./carTypes";

const STORAGE_KEY = "cars";

export async function loadCars(): Promise<CarRecord[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function getCarById(id: string): Promise<CarRecord | undefined> {
  const cars = await loadCars();
  return cars.find(c => c.id === id);
}

export async function addCar(car: CarRecord) {
  const cars = await loadCars();
  cars.push(car);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cars));
}

export async function updateCar(id: string, patch: Partial<CarRecord>) {
  const cars = await loadCars();
  const index = cars.findIndex(c => c.id === id);
  if (index === -1) return;

  cars[index] = { ...cars[index], ...patch };

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cars));
}

