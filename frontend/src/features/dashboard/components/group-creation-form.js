const GROUP_NAME_MAX_LENGTH = 150
const DESCRIPTION_MAX_LENGTH = 500
const LOCATION_MAX_LENGTH = 100

export function validateGroupCreation(values) {
  const errors = {}
  const groupName = values.groupName.trim()
  const description = values.description.trim()
  const location = values.location.trim()

  if (!groupName) {
    errors.groupName = "Enter a group name."
  } else if (groupName.length > GROUP_NAME_MAX_LENGTH) {
    errors.groupName = `Group name must be ${GROUP_NAME_MAX_LENGTH} characters or fewer.`
  }

  if (description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description =
      `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`
  }

  if (location.length > LOCATION_MAX_LENGTH) {
    errors.location =
      `Village/location must be ${LOCATION_MAX_LENGTH} characters or fewer.`
  }

  return errors
}

export function evaluateGroupCreation(values) {
  const errors = validateGroupCreation(values)

  return { errors }
}
