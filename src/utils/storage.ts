import AsyncStorage from "@react-native-async-storage/async-storage";

export async function saveItem(key: string, value: any) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.log("Storage save error:", err);
  }
}

export async function loadItem(key: string) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.log("Storage load error:", err);
    return null;
  }
}

export async function removeItem(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (err) {
    console.log("Storage remove error:", err);
  }
}

