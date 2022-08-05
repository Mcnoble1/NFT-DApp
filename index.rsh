'reach 0.1' 

export const main = Reach.App(() => { 
  const Creator = Participant('Creator', { // Creator is the first participant
    getSale: Fun([], Object({ // getSale is a function that returns an object
      nftId: Token, // NFT to be sold
      minBid: UInt, // minimum bid
      lenInBlocks: UInt, // how many blocks to wait before the auction starts
    })),
    auctionReady: Fun([], Null), // signal to start the auction
    seeBid: Fun([Address, UInt], Null), // Takes in the address of the bidder and the bid amount
    showOutcome: Fun([Address, UInt], Null), // Takes in the address of the winner and the bid amount
  });
  const Bidder = API('Bidder', {
    bid: Fun([UInt], Tuple(Address, UInt)), // Takes in the bid amount
  });
  init();

  Creator.only(() => {
    const { nftId, minBid, lenInBlocks } = declassify(interact.getSale()); // get the sale info
  });
  Creator.publish(nftId, minBid, lenInBlocks); // publish the sale info
  const amt = 1;
  commit();
  Creator.pay([[amt, nftId]]); // pay the nft into the contract
  Creator.interact.auctionReady(); // signal to start the auction
  assert(balance(nftId) == amt, "balance of NFT is wrong"); // check that the nft is in the contract
  const end = lastConsensusTime() + lenInBlocks; // get the end time of the auction
  const [
    highestBidder, // the address of the highest bidder
    lastPrice, // the last price
    isFirstBid, // whether this is the first bid or not (true if it is) (false if it is not)
  ] = parallelReduce([Creator, minBid, true]) // get the highest bidder, the last price, and whether this is the first bid
    .invariant(balance(nftId) == amt) // check that the nft is in the contract
    .invariant(balance() == (isFirstBid ? 0 : lastPrice)) // check the balance of the contract
    .while(lastConsensusTime() <= end) // while the auction is still running
    .api_(Bidder.bid, (bid) => { // get the bid from the bidder
      check(bid > lastPrice, "bid is too low"); // check that the bid is greater than the minimum bid
      return [bid, (notify) => {
        notify([highestBidder, lastPrice]); // notify the highest bidder and the last price
        if(!isFirstBid) {
          transfer(lastPrice).to(highestBidder); // transfer the last price to the highest bidder
        }
        const who = this; // get the address of the bidder
        Creator.interact.seeBid(who, bid); // signal to the creator that a bid has been made
        return [who, bid, false]; // return the bidder and the bid amount
      }]; // return the highest bidder and the last price
    })
    .timeout(absoluteTime(end), () => { // if the auction ends
      Creator.publish(); // publish the sale info
      return [highestBidder, lastPrice, isFirstBid]; // return the highest bidder, the last price, and whether this is the first bid 
    });

    transfer(amt, nftId).to(highestBidder); // transfer the nft to the highest bidder
    if (!isFirstBid) { // if this is not the first bid
      transfer(lastPrice).to(Creator); // transfer the last price to the highest bidder
    }
    Creator.interact.showOutcome(highestBidder, lastPrice); // signal to the creator that the auction has ended
    commit()
    exit();
});