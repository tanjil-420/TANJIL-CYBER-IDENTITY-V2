"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { readCookie } = require("../utils/cookies");

test("readCookie returns the decoded value for the requested cookie", () => {
    assert.equal(readCookie("other=first; tanjil.visitor=abc%2F123", "tanjil.visitor"), "abc/123");
});

test("readCookie ignores malformed cookie encoding", () => {
    assert.equal(readCookie("tanjil.visitor=%E0%A4%A", "tanjil.visitor"), null);
});

test("readCookie returns null when the cookie is absent", () => {
    assert.equal(readCookie("other=value", "tanjil.visitor"), null);
    assert.equal(readCookie(undefined, "tanjil.visitor"), null);
});
