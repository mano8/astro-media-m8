// Headless standalone smoke for the published tarball (`C12`).
//
// This file is compiled *and executed* against an installed
// `@mano8/astro-media-m8`, in a throwaway directory that has no workspace
// checkout above it — which is the point: `STANDALONE-CHILD-USABILITY` says the
// child must work with nothing but its own tarball. It touches only the
// headless subpaths, so it needs no React, no Astro and no running service.
import {
  assertMediaServiceM8Compatibility,
  getMediaServiceM8Compatibility,
  MEDIA_SERVICE_M8_CONTRACT,
  MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE
} from "@mano8/astro-media-m8/compatibility";
import { ObjectListParams } from "@mano8/astro-media-m8/schemas";
import { buildMediaRoutes } from "@mano8/astro-media-m8/routes";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[tarball-consumer] ${message}`);
}

// The contract the package declares must match what package.json publishes, or
// a consumer's compatibility check is asserting against a stale constant.
assert(
  MEDIA_SERVICE_M8_CONTRACT === "media-service-m8@1.1",
  `unexpected contract: ${MEDIA_SERVICE_M8_CONTRACT}`
);
assert(
  MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE === ">=2.0.0 <3.0.0",
  `unexpected service range: ${MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE}`
);

// A service inside the supported range is blessed; one past the supported major
// is named rather than tolerated.
assert(
  assertMediaServiceM8Compatibility({ version: "2.0.0" }).status === "compatible",
  "a service inside the supported range was not judged compatible"
);
assert(
  getMediaServiceM8Compatibility({ version: "3.0.0" }).status === "incompatible",
  "a service past the supported major was not rejected"
);

// A sibling M8 service serves the same payload shape at the same path, so the
// guard has to name it rather than bless it on a matching version (`A36`).
assert(
  getMediaServiceM8Compatibility({
    version: "2.0.0",
    contract: { name: "prompt-engine-m8", version: "2.0.0" }
  }).status === "incompatible",
  "a sibling service's /meta was not rejected"
);

// The category-scoped list vocabulary the tree skins drive survives the build.
const params = ObjectListParams.parse({
  category_id: "00000000-0000-0000-0000-000000000000",
  include_descendants: true
});
assert(params.include_descendants === true, "include_descendants did not survive the parse");
assert(
  !ObjectListParams.safeParse({ include_descendants: "yes" }).success,
  "a non-boolean include_descendants was accepted"
);

// The starter route map is buildable from the installed package and does not
// collide with itself.
const routes = buildMediaRoutes();
const patterns = Object.values(routes).filter(
  (pattern): pattern is string => typeof pattern === "string"
);
assert(patterns.length > 0, "the installed route builder produced no routes");
assert(
  new Set(patterns).size === patterns.length,
  `the default route map collides with itself: ${patterns.join(", ")}`
);

console.log("[tarball-consumer] installed package passed the headless smoke");
