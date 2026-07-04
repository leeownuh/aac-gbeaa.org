const { query } = require('../client');

const mapChangeRequestRow = (row) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    resourceType: row.resource_type,
    operation: row.operation,
    resourceId: row.resource_id,
    payload: row.payload || {},
    status: row.status,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
};

const createChangeRequest = async (record) => {
  const result = await query(
    `INSERT INTO content_change_requests (
      id, resource_type, operation, resource_id, payload, status,
      requested_by, reviewed_by, review_note, created_at, reviewed_at
    )
    VALUES (
      $1, $2, $3, $4, $5::jsonb, COALESCE($6, 'pending'),
      $7, $8, $9, COALESCE($10::timestamptz, NOW()), $11::timestamptz
    )
    RETURNING *`,
    [
      record.id,
      record.resourceType,
      record.operation,
      record.resourceId || null,
      JSON.stringify(record.payload || {}),
      record.status || 'pending',
      record.requestedBy,
      record.reviewedBy || null,
      record.reviewNote || null,
      record.createdAt || null,
      record.reviewedAt || null
    ]
  );

  return mapChangeRequestRow(result.rows[0]);
};

const getChangeRequestById = async (id) => {
  const result = await query(
    `SELECT *
     FROM content_change_requests
     WHERE id = $1`,
    [id]
  );

  return mapChangeRequestRow(result.rows[0]);
};

const listPendingChangeRequests = async () => {
  const result = await query(
    `SELECT *
     FROM content_change_requests
     WHERE status = 'pending'
     ORDER BY created_at ASC`
  );

  return result.rows.map(mapChangeRequestRow);
};

const listRecentChangeRequests = async (limit = 50) => {
  const result = await query(
    `SELECT *
     FROM content_change_requests
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map(mapChangeRequestRow);
};

const updateChangeRequestReview = async ({
  id,
  status,
  reviewedBy,
  reviewNote
}) => {
  const result = await query(
    `UPDATE content_change_requests
     SET status = $2,
         reviewed_by = $3,
         review_note = $4,
         reviewed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status, reviewedBy || null, reviewNote || null]
  );

  return mapChangeRequestRow(result.rows[0]);
};

module.exports = {
  createChangeRequest,
  getChangeRequestById,
  listPendingChangeRequests,
  listRecentChangeRequests,
  updateChangeRequestReview
};
