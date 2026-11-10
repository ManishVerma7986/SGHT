function GroupMembershipList({ groups, selectedGroupId, onSelect }) {
  return (
    <section className="dashboard-panel group-list-panel">
      <div className="panel-heading">
        <div>
          <h2>Your groups</h2>
          <p>
            {groups.length
              ? "Groups with an active membership."
              : "No active group memberships are linked to your account yet."}
          </p>
        </div>
        <span className="group-count">{groups.length}</span>
      </div>

      {groups.length === 0 ? (
        <div className="group-empty-state">
          <strong>No active groups found.</strong>
          <p>
            Your group details will appear here when an active membership is
            available.
          </p>
        </div>
      ) : (
        <div className="group-membership-list">
          {groups.map((group) => {
            const selected = String(group.groupId) === selectedGroupId

            return (
              <button
                className={`group-membership-card${selected ? " is-selected" : ""}`}
                key={group.groupId}
                type="button"
                onClick={() => onSelect(String(group.groupId))}
                aria-pressed={selected}
              >
                <span className="group-membership-card-heading">
                  <strong>{group.groupName}</strong>
                  <span>{group.groupCode}</span>
                </span>
                <span className="group-membership-meta">
                  <span>Role: {group.memberRole}</span>
                  <span>Status: {group.membershipStatus}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default GroupMembershipList
