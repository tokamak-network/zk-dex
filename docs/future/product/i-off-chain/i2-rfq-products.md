# I2. RFQ System - Real-World Products & User Experience

**Technical Specification**: [../../infrastructure/i-off-chain/i2-rfq.md](../../infrastructure/i-off-chain/i2-rfq.md)

---

## 1. "Private Quote Request" - Hiding Identity Even from Dealers

**Product Description**:
Fully anonymous quoting system where the requester's identity remains hidden even from dealers. Dealers provide quotes without knowing "who is requesting."

**User Experience**:
- Ms. Jung (45) needs to exchange $300K USDC
- Regular RFQ: Dealer learns "Ms. Jung requesting large exchange" → accumulates information
- Private RFQ: Dealer only sees "anonymous party requesting $300K exchange"
- Even after quote submission and execution, dealer doesn't know customer identity
- Ms. Jung's trading frequency and volume patterns not accumulated by dealers

**Observable Benefits**:
- Blocks dealer's customer information collection
- Prevents price discrimination based on trading history
- Receives equivalent quotes every time

## 2. "Quote Content Privacy" - Unselected Quotes Remain Secret Forever

**Product Description**:
Privacy RFQ where unselected quotes among multiple dealer quotes are never revealed, protecting dealers' pricing strategies.

**User Experience**:
- Chairman Park (60) sends RFQ for $10M BTC purchase
- Dealer A: $60,100, Dealer B: $60,050, Dealer C: $60,150 quotes
- Dealer B selected and executed
- Dealers A and C only know "my quote wasn't selected," don't see other quotes
- Competing dealers' pricing strategies not exposed to each other

**Observable Benefits**:
- Prevents dealer price collusion
- Protects dealers' independent pricing strategies
- Encourages fairer competitive quotes

## 3. "Transaction History Isolation" - Blocking Links Between Sequential RFQs

**Product Description**:
Service that prevents pattern analysis of "this person is continuously accumulating" by keeping sequential RFQ requests from the same user unlinked.

**User Experience**:
- Investment firm sends 5 large buy RFQs over a week
- Regular RFQ: Dealer identifies "this customer is accumulating" → adjusts prices
- History-isolated RFQ: Each request processed completely independently
- Dealer cannot tell if 5 requests are from same entity
- Large position building strategy not exposed to dealers

**Observable Benefits**:
- Prevents intent inference from sequential trades
- Keeps accumulation/distribution strategies private
- Maintains fair pricing (eliminates information asymmetry)

---

[Back to Index](../../README.md)
