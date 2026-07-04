import { Tabs } from "expo-router";

export default function AppTabs() {
  return (
    <Tabs>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="favourites" />
      <Tabs.Screen name="explore" />
    </Tabs>
  );
}
