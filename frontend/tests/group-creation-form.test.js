import test from "node:test"
import assert from "node:assert/strict"

import {
  evaluateGroupCreation,
  validateGroupCreation,
} from "../src/features/dashboard/components/group-creation-form.js"

test("requires a non-blank group name", () => {
  assert.deepEqual(
    validateGroupCreation({
      groupName: "   ",
      description: "",
      location: "",
    }),
    { groupName: "Enter a group name." }
  )
})

test("enforces existing name and location field limits", () => {
  const errors = validateGroupCreation({
    groupName: "G".repeat(151),
    description: "",
    location: "V".repeat(101),
  })

  assert.match(errors.groupName, /150 characters or fewer/)
  assert.match(errors.location, /100 characters or fewer/)
})

test("allows an optional description within the form limit", () => {
  assert.deepEqual(
    validateGroupCreation({
      groupName: "Hillview Group",
      description: "A local savings group.",
      location: "",
    }),
    {}
  )
})

test("valid details pass local validation without claiming persistence", () => {
  const result = evaluateGroupCreation({
    groupName: "Hillview Group",
    description: "",
    location: "Hillview",
  })

  assert.deepEqual(result.errors, {})
  assert.deepEqual(Object.keys(result), ["errors"])
})

test("invalid details do not produce a submission result", () => {
  const result = evaluateGroupCreation({
    groupName: "",
    description: "",
    location: "",
  })

  assert.ok(result.errors.groupName)
  assert.deepEqual(Object.keys(result), ["errors"])
})
