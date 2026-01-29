# Multi-Signature Notes - Products & User Experience

**Technical Specification**: [B2. Multi-Signature Notes](../../circuit-addons/b-time-conditions/b2-multisig.md)

---

## 1. "Anonymous DAO Governance" - Organizational Fund Management with Signer Identity Protection

**Product Description**:
A service that completely hides the identities of signers while managing DAO or organizational funds with multi-signature. Existing multisig like Gnosis Safe exposes all signer addresses, making them targets for social engineering attacks or coercion.

**General User Experience**:
- Human rights organization "FreedomWatch" operates a fund supporting activists under oppressive regimes
- 3 out of 5 board members must approve for fund disbursement (3-of-5)
- Using existing multisig exposes signer addresses on-chain → government can track signers
- Switching to ZK multisig: outsiders cannot determine who signers are or how many there are
- When approving transactions, only proves "sufficient number approved" not "who approved"
- Board members continue activities without personal threats, fund operated safely

**Observable Benefits**:
- Completely blocks blackmail, bribery, and social engineering attacks due to signer identity exposure
- Organization's decision-making structure and power distribution not disclosed externally
- Even when replacing signers, organizational structure changes are not tracked, preventing internal information leaks

## 2. "Corporate Finance Privacy" - Enterprise Fund Management with Hidden Organizational Structure

**Product Description**:
A service for multi-approval-based fund management while hiding the composition of corporate financial approvers from outsiders. Prevents competitors from identifying "who has payment authority" and targeting insiders.

**General User Experience**:
- Min-seo Jang (42), CFO of fintech company "PayFlow," establishes company operating fund management system
- Requires approval from 2 of 3 people: CEO, CFO, Finance Director (2-of-3)
- If competitors analyze public multisig and discover "Jang Min-seo is a payment approver" → recruitment attempts, target for internal information leaks
- Implements ZK multisig: signer composition completely private
- Outsiders can see "PayFlow wallet" but cannot know who controls it
- Competitor targeting of key personnel impossible, insider coercion attempts also blocked

**Observable Benefits**:
- Defends against spear phishing and social engineering attacks targeting payment approvers
- Prevents company's internal authority structure from being exposed to competitors
- When executives change, organizational restructuring information doesn't leak externally

## 3. "Whistleblower Protection Fund" - Anonymous Approval System for Informant Support

**Product Description**:
A service that protects the identities of approvers when news organizations or civic groups financially support whistleblowers. Blocks the target company or government from tracking "who supports the informant" and retaliating.

**General User Experience**:
- Investigative journalism outlet "Eye of Truth" decides to provide legal cost support to corporate misconduct whistleblower
- Requires approval from 3 of 4 people: Editor-in-chief, 2 reporters, lawyer (3-of-4)
- If target corporation identifies "who is helping the informant" → pressure on those reporters, lawsuit threats
- Support fund approval via ZK multisig: approver identities completely private
- Corporation only knows "someone from Eye of Truth approved," cannot identify individual reporters
- Reporters can continue public interest activities without fear of retaliation

**Observable Benefits**:
- Makes retaliation against individuals participating in whistleblower support activities impossible
- Realizes "supporter protection" similar to journalism's source protection
- Removes psychological barriers to public interest participation, encouraging more involvement
