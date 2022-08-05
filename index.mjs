import { loadStdlib } from '@reach-sh/stdlib';
import * as backend from './build/index.main.mjs';

const stdlib = loadStdlib(); // Load the stdlib

const startingBalance = stdlib.parseCurrency(100);  // Create a starting balance
console.log(`Creating a Test account for Creator`); // Create a test account for the creator
const accCreator = await stdlib.newTestAccount(startingBalance); // Create a test account for the creator

console.log(`Having creator create a testing NFT `);
const theNFT = await stdlib.launchToken(accCreator, "bumple", "NFT", { supply: 1 }); // Creator creates the NFT
const nftId = theNFT.id; // NFT id
const minBid = stdlib.parseCurrency(2); // minimum bid
const lenInBlocks = 10; // how many blocks to wait before the auction starts
const nftParams = {nftId, minBid, lenInBlocks}; // params for the NFT

let done = false;
const bidders = [];
const startBidders = async() => {
  let bid = minBid; // start with the minimum bid
  const runBidder = async(who) => { // run the bidder function
    const increment = stdlib.parseCurrency(Math.random() * 10); // increment bid by 1
    bid = bid.add(increment); // increment bid

    const acc = await stdlib.newTestAccount(startingBalance); // create a new test account
    acc.setDebugLabel(who); // set the debug label 
    await acc.tokenAccept(nftId); // accept the NFT from the creator
    bidders.push([who, acc]);
    const ctc = acc.contract(backend, ctcCreator.getInfo()); // create a contract instance for the account
    const getBalance = async () => stdlib.formatCurrency(await stdlib.balanceOf(acc)); // get the balance

    console.log(`${who} is bidding ${stdlib.formatCurrency(bid)}`); // log the bid
    console.log(`${who} balance before is ${await getBalance()}`); // log the balance

    try {
      const [ lastBidder, lastBid ] = await ctc.apis.Bidder.bid(bid); // bid the NFT
      console.log(`${who} outbids ${lastBidder} who bids ${stdlib.formatCurrency(lastBid)}.`); // log the bid	
    } catch (e) { 
      console.log(`${who} failed to bid because the auction is over.`); 
    }
    console.log(`${who} balance after is ${await getBalance()}`); // log the balance
  };

  await runBidder('Alice');
  await runBidder('Bob');
  await runBidder('Charlie');
  while (!done) {
    await stdlib.wait(1);
  }
};

const ctcCreator = accCreator.contract(backend); // create a contract instance for the creator
await ctcCreator.participants.Creator({ // create a participant instance for the creator
  getSale: () => { // get the sale info
    console.log(`Creator sets parameters of sale: `, nftParams); // log the sale info
    return nftParams;  // return the sale info
  },
  auctionReady: () => { // get the auction ready info
    startBidders();    // start the bidders
  },
  seeBid: (who, amt) => { // get the bid info
    console.log(`Creator saw that ${stdlib.formatAddress(who)} bids ${stdlib.formatCurrency(amt)}.`); // log the bid info
  },
  showOutcome: (winner, amt) => { // get the outcome info
    console.log(`Creator saw that ${stdlib.formatAddress(winner)} won with ${stdlib.formatCurrency(amt)}.`); // log the outcome info
  }
});

for ( const [who, acc] of bidders ) { // for each bidder
  const [ amt, amtNFT ] = await stdlib.balancesOf(acc, [null, nftId]); // get the balance
  console.log(`${who} has ${stdlib.formatCurrency(amt)} ${stdlib.standardUnit} and ${amtNFT} of the NFT.`); // log the balance
}

done = true;
