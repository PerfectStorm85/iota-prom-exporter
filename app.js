'use strict'

const express = require('express')
const app = express()
const config = require('./config')
const promclient = require('prom-client')
let Gauge = promclient.Gauge

let trades = {}

const nodeInfo = require('./nodeInfo')
const neighborInfo = require('./neighborInfo')
const tangleInfo = require('./tangleInfo')
const marketInfoSocket = require('./marketInfoSocketRC')(trades) 

let totalTransactions = new Gauge({ name: 'iota_node_info_total_transactions_queued', help: 'Total open txs at the interval' })
let totalTips = new Gauge({ name: 'iota_node_info_total_tips', help: 'Total tips at the interval' })
let totalNeighbors = new Gauge({ name: 'iota_node_info_total_neighbors', help: 'Total neighbors at the interval' })
let latestMilestone = new Gauge({ name: 'iota_node_info_latest_milestone', help: 'Tangle milestone at the interval' })
let latestSolidSubtangleMilestone = new Gauge({ name: 'iota_node_info_latest_subtangle_milestone', help: 'Subtangle milestone at the interval' })
let newTransactions = new Gauge({ name: 'iota_neighbors_new_transactions', help: 'New transactions by neighbor', labelNames: ['id'] })
let randomTransactions = new Gauge({ name: 'iota_neighbors_random_transactions', help: 'Random transactions by neighbor', labelNames: ['id'] })
let allTransactions = new Gauge({ name: 'iota_neighbors_all_transactions', help: 'All transactions by neighbor', labelNames: ['id'] })
let invalidTransactions = new Gauge({ name: 'iota_neighbors_invalid_transactions', help: 'Invalid transactions by neighbor', labelNames: ['id'] })
let activeNeighbors = new Gauge({ name: 'iota_neighbors_active_neighbors', help: 'Number of neighbors who are active' })
let totalTx = new Gauge({ name: 'iota_tangle_total_txs', help: 'Number of total transaction from the whole tangle' })
let confirmedTx = new Gauge({ name: 'iota_tangle_confirmed_txs', help: 'Number of confirmed transactions from the whole tangle' })
// let logTotalTransactions = new Gauge({ name: 'iota_tangle_logged_total_txs', help: 'Number of totalTransactions from the java process output' })
let tradePrice = new Gauge({ name: 'iota_market_trade_price', help: 'Latest price from Bitfinex', labelNames: ['pair'] })
let tradeVolume = new Gauge({ name: 'iota_market_trade_volume', help: 'Latest volume from Bitfinex', labelNames: ['pair'] })

app.get('/metrics', (req, res) => {
    // If unsure about whether Prometheus is calling the app
    // Uncomment the below line and look for a dot in the logs. 
    // console.log('.')
        
    async function getResults() {

        newTransactions.reset()
        invalidTransactions.reset()
        allTransactions.reset()
        randomTransactions.reset()

        try {
            const [nodeResults, neighborResults, tangleResults] = await Promise.all([nodeInfo(), neighborInfo(), tangleInfo()])

            // node info
            totalTransactions.set(nodeResults.transactionsToRequest)
            totalTips.set(nodeResults.tips)
            totalNeighbors.set(nodeResults.neighbors)
            latestMilestone.set(nodeResults.latestMilestoneIndex)
            latestSolidSubtangleMilestone.set(nodeResults.latestSolidSubtangleMilestoneIndex)

            // neighbor info
            let connectedNeighbors = 0
            neighborResults.forEach((r) => {
                newTransactions.set({ id: r.address }, r.numberOfNewTransactions)
                invalidTransactions.set({ id: r.address }, r.numberOfInvalidTransactions)
                allTransactions.set({ id: r.address }, r.numberOfAllTransactions)
                randomTransactions.set({ id: r.address }, r.numberOfRandomTransactionRequests)
                if (r.numberOfNewTransactions + r.numberOfInvalidTransactions + r.numberOfAllTransactions + r.numberOfRandomTransactionRequests) {
                    connectedNeighbors += 1
                }
            })
            activeNeighbors.set(connectedNeighbors)

            // tangle info
            totalTx.set(parseInt(tangleResults.totalTx))
            confirmedTx.set(parseInt(tangleResults.confirmedTx))
            
            // the below requires a custom IXI
            // logTotalTransactions.set(parseInt(tangleResults.totalTransactions))

            // market info
            tradePrice.set({ pair: 'IOTUSD' }, trades.IOTUSD.price)
            tradeVolume.set({ pair: 'IOTUSD' }, Number(trades.IOTUSD.volume))
            tradePrice.set({ pair: 'IOTEUR' }, trades.IOTEUR.price)
            tradeVolume.set({ pair: 'IOTEUR' }, Number(trades.IOTEUR.volume))
            tradePrice.set({ pair: 'IOTBTC' }, trades.IOTBTC.price)
            tradeVolume.set({ pair: 'IOTBTC' }, Number(trades.IOTBTC.volume))
            tradePrice.set({ pair: 'IOTETH' }, trades.IOTETH.price)
            tradeVolume.set({ pair: 'IOTETH' }, Number(trades.IOTETH.volume))
            tradePrice.set({ pair: 'BTCUSD' }, trades.BTCUSD.price)
            tradeVolume.set({ pair: 'BTCUSD' }, Number(trades.BTCUSD.volume))
            tradePrice.set({ pair: 'BTCEUR' }, trades.BTCEUR.price)
            tradeVolume.set({ pair: 'BTCEUR' }, Number(trades.BTCEUR.volume))
            tradePrice.set({ pair: 'ETHUSD' }, trades.ETHUSD.price)
            tradeVolume.set({ pair: 'ETHUSD' }, Number(trades.ETHUSD.volume))

            res.end(promclient.register.metrics())

        } catch (error) {
            console.log(error)
            res.end()
        }
    }
    getResults()
})

app.listen(config.bind_port, config.bind_address, () => {
    console.log('Listening on:', config.bind_port)
})
