"use strict";

function readCookie(header, name) {
    if (typeof header !== "string") return null;

    for (const part of header.split(";")) {
        const separator = part.indexOf("=");
        if (separator < 0 || part.slice(0, separator).trim() !== name) continue;

        try {
            return decodeURIComponent(part.slice(separator + 1).trim());
        } catch {
            return null;
        }
    }

    return null;
}

module.exports = { readCookie };
