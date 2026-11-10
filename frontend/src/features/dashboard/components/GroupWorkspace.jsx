import { useEffect, useState } from "react"

import { apiRequest } from "../../../services/api"
import { createGroupService } from "../../../services/group.service"
import GroupCreationForm from "./GroupCreationForm"
import GroupMembershipList from "./GroupMembershipList"
import GroupRequestList from "./GroupRequestList"

const groupService = createGroupService({ apiRequest })
const DIRECTORY_PAGE_SIZE = 25

function isValidGroupsResponse(data) {
  return data &&
    Array.isArray(data.groups) &&
    data.groups.every((group) =>
      group &&
      Number.isSafeInteger(group.groupId) &&
      group.groupId > 0 &&
      typeof group.groupName === "string" &&
      typeof group.groupCode === "string" &&
      typeof group.memberRole === "string" &&
      group.membershipStatus === "ACTIVE"
    )
}

function isValidGroupData(groupResponse, membershipResponse, profileResponse, groupId) {
  const group = groupResponse?.group
  const membership = membershipResponse?.membership
  const profile = profileResponse?.profile

  return (
    group &&
    group.groupId === groupId &&
    typeof group.groupName === "string" &&
    typeof group.groupCode === "string" &&
    typeof group.groupStatus === "string" &&
    membership &&
    membership.groupId === groupId &&
    typeof membership.memberRole === "string" &&
    profile &&
    typeof profile.fullName === "string" &&
    profile.fullName.trim()
  )
}

function getSafeErrorMessage(error) {
  if (error?.status === 401) {
    return "Your session may have expired. Sign in again to continue."
  }
  return "We couldn’t load your group information. Please try again."
}

function formatFormationDate(value) {
  if (typeof value !== "string") {
    return "Not available"
  }

  const dateOnly = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)
    ? dateOnly
    : "Not available"
}

function GroupWorkspace({ getAccessToken, onLogout }) {
  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState("")
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [groupsRetry, setGroupsRetry] = useState(0)
  const [groupData, setGroupData] = useState(null)
  const [groupDataLoading, setGroupDataLoading] = useState(false)
  const [groupDataError, setGroupDataError] = useState("")
  const [groupDataRetry, setGroupDataRetry] = useState(0)
  const [directory, setDirectory] = useState(null)
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [directoryError, setDirectoryError] = useState("")
  const [directoryPage, setDirectoryPage] = useState(1)
  const [directoryRetry, setDirectoryRetry] = useState(0)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [requestRefresh, setRequestRefresh] = useState(0)
  const refreshRequests = () => setRequestRefresh((value) => value + 1)

  function groupRequestPanels() {
    return (
      <>
        <GroupCreationForm
          getAccessToken={getAccessToken}
          onSubmitted={refreshRequests}
        />
        <GroupRequestList
          getAccessToken={getAccessToken}
          refreshKey={requestRefresh}
        />
      </>
    )
  }

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    async function loadGroups() {
      setGroupsLoading(true)
      setGroupsError("")

      try {
        const token = await getAccessToken()
        if (!token) {
          const error = new Error("Access token unavailable.")
          error.status = 401
          throw error
        }

        const response = await groupService.getCurrentGroups(token, {
          signal: controller.signal,
        })

        if (!active) {
          return
        }
        if (!isValidGroupsResponse(response)) {
          throw new Error("Invalid groups response.")
        }

        setGroups(response.groups)
        setSelectedGroupId(
          response.groups.length === 1
            ? String(response.groups[0].groupId)
            : ""
        )
        setDirectoryPage(1)
        setSessionExpired(false)
      } catch (error) {
        if (active && error?.name !== "AbortError") {
          setGroupsError(getSafeErrorMessage(error))
          setSessionExpired(error?.status === 401)
          setGroups([])
          setSelectedGroupId("")
        }
      } finally {
        if (active) {
          setGroupsLoading(false)
        }
      }
    }

    loadGroups()

    return () => {
      active = false
      controller.abort()
    }
  }, [getAccessToken, groupsRetry])

  useEffect(() => {
    if (!selectedGroupId) {
      return undefined
    }

    const groupId = Number(selectedGroupId)
    const controller = new AbortController()
    let active = true

    async function loadGroupData() {
      setGroupData(null)
      setGroupDataLoading(true)
      setGroupDataError("")

      try {
        const token = await getAccessToken()
        if (!token) {
          const error = new Error("Access token unavailable.")
          error.status = 401
          throw error
        }

        const [groupResponse, membershipResponse, profileResponse] =
          await groupService.getSelectedGroupData(
            token,
            groupId,
            { signal: controller.signal }
          )

        if (!active) {
          return
        }
        if (
          !isValidGroupData(
            groupResponse,
            membershipResponse,
            profileResponse,
            groupId
          )
        ) {
          throw new Error("Invalid group response.")
        }

        setGroupData({
          group: groupResponse.group,
          membership: membershipResponse.membership,
          profile: profileResponse.profile,
        })
      } catch (error) {
        if (active && error?.name !== "AbortError") {
          setGroupDataError(getSafeErrorMessage(error))
          setSessionExpired(error?.status === 401)
        }
      } finally {
        if (active) {
          setGroupDataLoading(false)
        }
      }
    }

    loadGroupData()

    return () => {
      active = false
      controller.abort()
    }
  }, [getAccessToken, selectedGroupId, groupDataRetry])

  useEffect(() => {
    if (!selectedGroupId) {
      return undefined
    }

    const groupId = Number(selectedGroupId)
    const controller = new AbortController()
    let active = true

    async function loadDirectory() {
      setDirectory(null)
      setDirectoryLoading(true)
      setDirectoryError("")

      try {
        const token = await getAccessToken()
        if (!token) {
          const error = new Error("Access token unavailable.")
          error.status = 401
          throw error
        }

        const response = await groupService.getGroupMembers(
          token,
          groupId,
          directoryPage,
          DIRECTORY_PAGE_SIZE,
          { signal: controller.signal }
        )

        if (!active) {
          return
        }
        if (
          !response ||
          !Array.isArray(response.members) ||
          !response.pagination ||
          response.pagination.page !== directoryPage ||
          response.pagination.limit !== DIRECTORY_PAGE_SIZE ||
          typeof response.pagination.hasMore !== "boolean" ||
          !response.members.every((member) =>
            member &&
            typeof member.fullName === "string" &&
            typeof member.memberRole === "string" &&
            typeof member.membershipStatus === "string" &&
            (member.joinedDate === null ||
              typeof member.joinedDate === "string")
          )
        ) {
          throw new Error("Invalid member directory response.")
        }

        setDirectory(response)
      } catch (error) {
        if (active && error?.name !== "AbortError") {
          setDirectoryError(getSafeErrorMessage(error))
          setSessionExpired(error?.status === 401)
        }
      } finally {
        if (active) {
          setDirectoryLoading(false)
        }
      }
    }

    loadDirectory()

    return () => {
      active = false
      controller.abort()
    }
  }, [getAccessToken, selectedGroupId, directoryPage, directoryRetry])

  const selectedGroup = groups.find(
    (group) => String(group.groupId) === selectedGroupId
  )

  function handleGroupChange(event) {
    setSelectedGroupId(
      typeof event === "string" ? event : event.target.value
    )
    setDirectoryPage(1)
    setGroupData(null)
    setDirectory(null)
    setSessionExpired(false)
  }

  if (groupsLoading) {
    return (
      <section className="group-workspace" aria-label="Group management">
        <section className="dashboard-panel" aria-busy="true">
          <p role="status">Loading your groups...</p>
        </section>
        {groupRequestPanels()}
      </section>
    )
  }

  if (groupsError) {
    return (
      <section className="group-workspace" aria-label="Group management">
        <section className="dashboard-panel">
          <h2>Your groups</h2>
          <p role="alert">{groupsError}</p>
          {sessionExpired ? (
            <button className="secondary-button" type="button" onClick={onLogout}>
              Sign out
            </button>
          ) : (
            <button
              className="secondary-button"
              type="button"
              onClick={() => setGroupsRetry((retry) => retry + 1)}
            >
              Try again
            </button>
          )}
        </section>
        {groupRequestPanels()}
      </section>
    )
  }

  if (groups.length === 0) {
    return (
      <section className="group-workspace" aria-label="Group management">
        <GroupMembershipList
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelect={handleGroupChange}
        />
        {groupRequestPanels()}
      </section>
    )
  }

  return (
    <section className="group-workspace" aria-label="Group management">
      <GroupMembershipList
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelect={handleGroupChange}
      />

      {!selectedGroupId ? (
        <section className="dashboard-panel group-empty-state">
          <strong>Select one of your groups to continue.</strong>
        </section>
      ) : (
        <>
          {groupDataLoading && (
            <section className="dashboard-panel" aria-busy="true">
              <p role="status">Loading group information...</p>
            </section>
          )}

          {groupDataError && (
            <section className="dashboard-panel">
              <p role="alert">{groupDataError}</p>
              {sessionExpired ? (
                <button className="secondary-button" type="button" onClick={onLogout}>
                  Sign out
                </button>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setGroupDataRetry((retry) => retry + 1)}
                >
                  Try again
                </button>
              )}
            </section>
          )}

          {groupData && (
            <>
              <section className="dashboard-panel group-overview-panel">
                <div className="panel-heading">
                  <div>
                    <h2>{groupData.group.groupName}</h2>
                    <p>{groupData.group.groupCode}</p>
                  </div>
                  <span className="group-role-badge">
                    {groupData.membership.memberRole}
                  </span>
                </div>
                <dl className="group-details-grid">
                  <div>
                    <dt>Village</dt>
                    <dd>{groupData.group.village || "Not available"}</dd>
                  </div>
                  <div>
                    <dt>District</dt>
                    <dd>{groupData.group.district || "Not available"}</dd>
                  </div>
                  <div>
                    <dt>State</dt>
                    <dd>{groupData.group.state || "Not available"}</dd>
                  </div>
                  <div>
                    <dt>Formation date</dt>
                    <dd>{formatFormationDate(groupData.group.formationDate)}</dd>
                  </div>
                  <div>
                    <dt>Membership status</dt>
                    <dd>{selectedGroup.membershipStatus}</dd>
                  </div>
                  <div>
                    <dt>Group status</dt>
                    <dd>{groupData.group.groupStatus}</dd>
                  </div>
                </dl>
                <p className="member-profile-name">
                  Member: <strong>{groupData.profile.fullName}</strong>
                </p>
              </section>

              <section className="dashboard-panel directory-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Group members</h2>
                    <p>Active members of this group</p>
                  </div>
                  {directory && (
                    <span className="directory-page-label">
                      Page {directory.pagination.page}
                    </span>
                  )}
                </div>

                {directoryLoading && (
                  <p role="status" aria-busy="true">Loading members...</p>
                )}

                {directoryError && (
                  <>
                    <p role="alert">{directoryError}</p>
                    {sessionExpired ? (
                      <button className="secondary-button" type="button" onClick={onLogout}>
                        Sign out
                      </button>
                    ) : (
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setDirectoryRetry((retry) => retry + 1)}
                      >
                        Try again
                      </button>
                    )}
                  </>
                )}

                {directory && !directoryLoading && (
                  <>
                    {directory.members.length === 0 ? (
                      <div className="group-empty-state">
                        <strong>No active members to display.</strong>
                      </div>
                    ) : (
                      <div className="member-directory">
                        {directory.members.map((member, index) => (
                          <article
                            className="member-directory-row"
                            key={`${member.fullName}-${member.joinedDate || "unknown"}-${index}`}
                          >
                            <div>
                              <strong>{member.fullName}</strong>
                              <span>{member.memberRole}</span>
                            </div>
                            <div className="member-directory-meta">
                              <span>{member.membershipStatus}</span>
                              <span>
                                Joined {member.joinedDate || "date unavailable"}
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                    <nav className="directory-pagination" aria-label="Member directory pages">
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={directoryPage <= 1 || directoryLoading}
                        onClick={() => setDirectoryPage((page) => page - 1)}
                      >
                        Previous
                      </button>
                      <span>Page {directoryPage}</span>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={
                          !directory.pagination.hasMore ||
                          directoryPage * DIRECTORY_PAGE_SIZE > 100000 ||
                          directoryLoading
                        }
                        onClick={() => setDirectoryPage((page) => page + 1)}
                      >
                        Next
                      </button>
                    </nav>
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}
      {groupRequestPanels()}
    </section>
  )
}

export default GroupWorkspace
