import { Redirect } from "expo-router";

// A saved flip is opened by id (/flip/[id]); with no id, the list of flips is History.
export default function FlipIndex() {
  return <Redirect href="/history" />;
}
