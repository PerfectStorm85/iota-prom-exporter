'use strict'

const zmq = require('zeromq')
const level = require('level')
const config = require('./config')
const set = require('lodash.set')
const transactions = level('./db', {valueEncoding: 'json'})
// require('timers')

let seenTxs = 0
let txsWithValue = 0
let confirmedTxs = 0

module.exports = (zmqStats, confirmationTimeHisto) => {

    let processNewSeenTransaction = async (tx) => {
        try {
            const newSeen = await transactions.get(tx)
        } catch (error) {
            if (error.notFound) {
                await transactions.put(tx, {
                    seenDate: Date.now()
                })
            }
        }
    }

    let processNewConfirmedTransaction = async (tx) => {
        try {
            const newConfirmed = await transactions.get(tx)
            let confirmMoment = Date.now()
            await transactions.put(tx, {
                'seenDate': newConfirmed.seenDate,
                'confirmedDate': confirmMoment
            })
            confirmationTimeHisto.observe((confirmMoment - newConfirmed.seenDate) / 1000)
        } catch (error) {
            if (error.notFound) {
                await transactions.put(tx, {
                    confirmedDate: Date.now()
                })
            }
        }
    }

    if (config.zmq_url) {

        let sock = zmq.socket('sub')
        // sets reconnect to 20 seconds
        sock.setsockopt(zmq.ZMQ_RECONNECT_IVL, 20000)
        sock.connect('tcp://' + config.zmq_url)
        console.log('zmq socket connected')

        // subscribe to all messages
        sock.subscribe('')
        sock.monitor(10000, 0)

        sock.on('message', (topic) => {
            let arr = topic.toString().split(' ')

            if (arr[0] === 'tx') {
                processNewSeenTransaction(arr[1])
                set(zmqStats, 'seenTxs', seenTxs++)
                if (arr[3] !== '0') {
                    set(zmqStats, 'txsWithValue', txsWithValue++)
                }
            } else if (arr[0] === 'rstat') {
                let rs = {
                    'toProcess': arr[1],
                    'toBroadcast': arr[2],
                    'toRequest': arr[3],
                    'toReply': arr[4],
                    'totalTransactions': arr[5]
                }
                set(zmqStats, 'rstats', rs)

            } else if (arr[0] === 'sn') {
                processNewConfirmedTransaction(arr[2])
                set(zmqStats, 'confirmedTxs', confirmedTxs++)
            }
        })

        sock.on('connect_retry', (eventVal, endPoint, err ) => {
            console.log('zmq is in "connect_retry" eventVal, endPoit, err', eventVal, endPoint, err)
        })

        sock.on('disconnect', (eventVal, endPoint, err) => {
            console.log('zmq is in "disconnect" err', err)
        })

    } else {
        console.log('ZMQ is not configured')
    }
}
