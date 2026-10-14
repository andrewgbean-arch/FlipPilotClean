import "./setupEnv";
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { networkOf } from "../utils/clientAddress";

// Limits keyed on a client's address must not be got round by changing address. A home or phone
// connection owns a whole IPv6 /64, so the /64 is the unit; counting single IPv6 addresses would give a
// script a fresh allowance on every request.

describe("networkOf", () => {
  test("IPv4 is the address itself", () => {
    assert.equal(networkOf("203.0.113.7"), "203.0.113.7");
    assert.equal(networkOf("127.0.0.1"), "127.0.0.1");
  });

  test("IPv4 written as IPv6 is the IPv4 address (so the two spellings are one network)", () => {
    assert.equal(networkOf("::ffff:203.0.113.7"), "203.0.113.7");
    assert.equal(networkOf("::FFFF:203.0.113.7"), "203.0.113.7");
  });

  test("every IPv6 address in one /64 is the same network", () => {
    const a = networkOf("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const b = networkOf("2001:db8:1:2:1111:2222:3333:4444");
    const c = networkOf("2001:db8:1:2::1");
    assert.equal(a, "v6:2001:db8:1:2");
    assert.equal(b, a);
    assert.equal(c, a);
  });

  test("a different /64 is a different network", () => {
    assert.notEqual(networkOf("2001:db8:1:2::1"), networkOf("2001:db8:1:3::1"));
    assert.notEqual(networkOf("2001:db8:1:2::1"), networkOf("2001:db9:1:2::1"));
  });

  test("compressed, padded and upper-case spellings of one address agree", () => {
    const want = "v6:2001:db8:0:0";
    assert.equal(networkOf("2001:db8::1"), want);
    assert.equal(networkOf("2001:0db8:0000:0000:0000:0000:0000:0001"), want);
    assert.equal(networkOf("2001:DB8::ABCD"), want);
  });

  test("a leading :: and a zone id are handled", () => {
    assert.equal(networkOf("::1"), "v6:0:0:0:0");
    assert.equal(networkOf("fe80::1%eth0"), "v6:fe80:0:0:0");
  });

  test("an IPv6 address with an IPv4 tail is read", () => {
    assert.equal(networkOf("64:ff9b::203.0.113.7"), "v6:64:ff9b:0:0");
  });

  test("nothing, or something unreadable, is not invented into a network", () => {
    assert.equal(networkOf(undefined), null);
    assert.equal(networkOf(null), null);
    assert.equal(networkOf(""), null);
    assert.equal(networkOf("   "), null);
    // Not valid IPv6: used exactly as given rather than guessed at.
    assert.equal(networkOf("not:an:address"), "not:an:address");
    assert.equal(networkOf("1:2:3:4:5:6:7:8:9"), "1:2:3:4:5:6:7:8:9");
    assert.equal(networkOf("1::2::3"), "1::2::3");
  });
});
