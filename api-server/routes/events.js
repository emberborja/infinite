// event related API endpoints

const EventController = require('../controllers/events')
const CurrentEventController = require('../controllers/currentEvents')
const { getDefaultRouter } = require('./helpers/routeHelpers')
const { literal } = require('sequelize')
const JWTAuthenticator = require(__dirname + '/../utils/JWTAuthenticator')
const DatesToISO = require(__dirname + '/middleware/datesToISO')
const axios = require('axios')
const uuidv1 = require('uuid/v1');

const BITLY_URI ='https://api-ssl.bitly.com/v3/shorten'
const BITLY_TOKEN = process.env.BITLY_TOKEN
const BITLY_BASE = process.env.APP_URL || 'https://infinite.industries'

const filterContactInfo = (req, data) => {
	if (req.isInfiniteAdmin) {
		return
	} else if (Array.isArray(data)) {
		data.forEach(item => {
			item.set('organizer_contact', undefined)
		})
	} else if (!!data) {
		data.set('organizer_contact', undefined)
	}
}

const router = getDefaultRouter("events", "event", EventController, { verified: false }, {
	// provides special controller methods for getters to merge data from multiple tables
	allMethod: EventController.allAndMergeWithVenues,
	byIDMethod: EventController.findByIDAndMergeWithVenues,
	createMiddleware: [DatesToISO, createOverride], // anyone can create a new event; Dates will be converted form local to UTC/ISO
	updateMiddleware: [JWTAuthenticator(true)], // requires admin token to update (put)
	readFilter: filterContactInfo // strip contact info
});

// get current non or un-verified events
router.get('/current/non-verified',
  [JWTAuthenticator(true)], // only admin can see non-verified events
  function(req, res) {
		const query = {
			where: {
				verified: false
			}
		}

		//query.where.time_end[Op.gte] = dt
    //const query = { $and: [{ time_end: { $gt: dt }}, { verified: { $ne: true }}] };
    CurrentEventController.all(req.app.get('db'), function(err, events) {
    	if (err) {
            console.warn('error getting current/verified events: ' + err);
            return res.status(501).json({ status: 'failed: ' + err });
        }

        res.status(200).json({ status: 'success', events });
    }, query);
});

// get current verified events
router.get('/current/verified',
  function(req, res) { // anyone can read verified events
	const query = {
		where: {
		  verified: true
		},
	  	order: literal('start_time ASC')
	}

	CurrentEventController.all(req.app.get('db'), function(err, events) {
		if (err) {
			console.warn('error getting current/verified events: ' + err);
			return res.status(501).json({ status: 'failed: ' + err });
		}

		filterContactInfo(req, events)

		res.status(200).json({ status: 'success', events });
	}, query);
});

// allows admins to tag an event as verified
router.put(
	'/verify/:id',
  	[JWTAuthenticator(true)], // restrict to admin/token
  	(req, res) => {
		const id = req.params.id;

        console.log(`handling request to verify event "${id}"`)

		if (!id)
			return res.status(404).json({ status: 'id is a required field' });

		EventController.update(req.app.get('db'), id, { verified: true }, function(err) {
			if (err)
				return res.status(500).json({ status: 'failed: ' + err });

			res.status(200).json({ status: 'success' });
		});
	}
);

async function createOverride(req, res, next) {
	if (!req.body.event)
		return res.status(422).json({ status: 'event parameter is required' })

	try {
		const id = uuidv1()

		const bitlyLink = await _createBitlyLink(`${BITLY_BASE}/events/${id}`)

		const postJSON = {
			...req.body.event,
			id,
			bitly_link: bitlyLink,
			slug: _getSlug(req.body.event.title)
		}

		CurrentEventController.create(req.app.get('db'), postJSON, async (err) => {
			if (err) {
				const msg = 'error creating "event": ' + err
				console.warn(msg)
				return res.status(500).json({ status: msg })
			}

			res.status(200).json({ status: 'success', id: postJSON.id })
		});
	} catch (ex) {
		console.warn('error calling link shortener: ', ex)
		res.status(500).json({ status: 'error calling link shortener' })
	}
}

async function _createBitlyLink(infiniteUrl) {
	const requestUrl = `${BITLY_URI}?access_token=${BITLY_TOKEN}&longUrl=${encodeURI(infiniteUrl)}`

	const { data } = await axios.get(requestUrl)


	if (data.status_code != 200) {
		throw new Error(`Status ${ data.status_code } returned from link shortener`)
	} else {
		return data.data.url
	}
}

function _getSlug(title) {
	if (!title) {
		return 'missing-title'
	}

	return title.toLowerCase().replace(/ /g,'-')
}

module.exports = router;
