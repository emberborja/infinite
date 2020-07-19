/**
 * @swagger
 *
 * /events/tags/{tag}:
 *  get:
 *    description: Returns a list of all events by the provided tag (requires admin access)
 *    produces: application/json
 *    security:
 *      - jwt:
 *    parameters:
 *      - name: tag
 *        description: matches on this tag
 *        in: path
 *        required: true
 *        type: string
 *      - name: embed
 *        description: |+
 *          Specifies related entities to retrieve as embedded children of the event. For example, events have venues.
 *
 *          Allowed Values -- venue
 *        in: query
 *        required: false
 *        type: array
 *        items:
 *          type: string
 *        enum:
 *          - venue
 *    responses:
 *      200:
 *        description: Success!
 *        schema:
 *          $ref: '#definitions/EventsResponse'
 *      501:
 *        description: There was an error processing the request.
 *        schema:
 *          $ref: '#definitions/EventsResponse'
 *      422:
 *        description: A parameter supplied was not allowed or understood.
 *        schema:
 *          $ref: '#definitions/EventsResponse'
 */

const express = require('express')

const { handleRequestForEventsBySingleTag } = require('../../helpers')
const JWTAuthenticator = require('../../../../utils/JWTAuthenticator')
const ParseEmbed = require('../../../middleware/parseEmbeds')

const router = express.Router({ mergeParams: true })

router.use([
  JWTAuthenticator(true),
  ParseEmbed,
  getAllEventsBySingleTag
])

async function getAllEventsBySingleTag (req, res) {
  handleRequestForEventsBySingleTag(req, res, null)
}

module.exports = router
