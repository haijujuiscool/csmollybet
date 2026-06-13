import { useState } from 'react';
import { Shield, FileText } from 'lucide-react';

const tabStyle = (active) => ({
  flex: 1, padding: '12px 20px', fontSize: '14px', fontWeight: 700,
  background: active ? 'var(--accent-gold)' : 'transparent',
  color: active ? '#000' : '#888',
  border: active ? 'none' : '1px solid #333',
  borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
});

const sectionTitle = {
  fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-gold)',
  borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '16px', marginTop: '32px'
};

const subTitle = {
  fontSize: '1.05rem', fontWeight: 600, color: '#fff', margin: '18px 0 8px'
};

const bodyText = {
  color: '#aaa', fontSize: '14px', lineHeight: '1.75', marginBottom: '12px'
};

const bodyList = {
  color: '#aaa', fontSize: '14px', lineHeight: '1.75', marginBottom: '12px', paddingLeft: '20px'
};

export default function Terms() {
  const [tab, setTab] = useState('tos');

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '20px' }}>
      <div style={{
        background: 'var(--bg-panel)', borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,107,53,0.1), rgba(255,140,0,0.05))',
          padding: '40px 40px 30px', textAlign: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', margin: '0 0 6px' }}>Legal</h1>
          <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>Last updated: June 12, 2026</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', padding: '20px 40px 0' }}>
          <button style={tabStyle(tab === 'tos')} onClick={() => setTab('tos')}>
            <FileText size={16} /> Terms of Service
          </button>
          <button style={tabStyle(tab === 'privacy')} onClick={() => setTab('privacy')}>
            <Shield size={16} /> Privacy Policy
          </button>
        </div>

        <div style={{ padding: '10px 40px 40px' }}>
          {tab === 'tos' ? (
            <div>
              <h2 style={sectionTitle}>1. Acceptance of Terms</h2>
              <p style={bodyText}>
                By accessing or using csmolly.bet (the "Platform"), you agree to be bound by these Terms of Service ("Terms"). 
                If you do not agree with any part of these Terms, you must immediately cease use of the Platform. 
                These Terms constitute a legally binding agreement between you ("User") and the operator of csmolly.bet ("Company").
              </p>
              <p style={bodyText}>
                The Company reserves the right to modify, update, or replace these Terms at any time. 
                Material changes will be communicated via the Platform or email. Continued use after any changes constitutes acceptance 
                of the new Terms. It is your responsibility to review these Terms periodically.
              </p>

              <h2 style={sectionTitle}>2. Eligibility</h2>
              <p style={bodyText}>
                You must be at least 18 years of age (or the age of legal majority in your jurisdiction, whichever is greater) 
                to register an account and use the Platform. By creating an account, you represent and warrant that:
              </p>
              <ul style={bodyList}>
                <li>You are at least 18 years of age or the age of majority in your jurisdiction;</li>
                <li>You have not been previously suspended or banned from the Platform;</li>
                <li>You are not located in a jurisdiction where the use of the Platform is prohibited by law;</li>
                <li>You are not a resident of any restricted jurisdiction including but not limited to the United States, 
                the United Kingdom, France, Netherlands, and any other jurisdiction where online gambling or skin betting 
                is prohibited;</li>
                <li>All information you provide during registration is accurate and complete.</li>
              </ul>
              <p style={bodyText}>
                The Company reserves the right to verify your age and identity at any time using third-party verification services. 
                Failure to comply with an age verification request may result in account suspension and forfeiture of all virtual balances.
              </p>

              <h2 style={sectionTitle}>3. Account Registration & Security</h2>
              <p style={bodyText}>
                Accounts are created exclusively through Steam OpenID authentication. You may not create multiple accounts. 
                Any attempt to create duplicate, shared, or fraudulent accounts will result in the termination of all associated 
                accounts and forfeiture of all balances.
              </p>
              <p style={bodyText}>
                You are solely responsible for maintaining the confidentiality of your Steam account credentials. 
                The Company is not liable for any loss or damage arising from unauthorized access to your account. 
                You agree to notify us immediately of any unauthorized use.
              </p>
              <p style={bodyText}>
                Account trading, selling, or transferring is strictly prohibited. Any account found to have been transferred 
                will be permanently banned without compensation.
              </p>

              <h2 style={sectionTitle}>4. Virtual Currency & Items</h2>
              <p style={bodyText}>
                The Platform uses "Gems" as a virtual in-platform currency. Gems have absolutely no real-world monetary value 
                and cannot be exchanged for cash, legal tender, or any other form of real currency. Gems are a non-refundable, 
                non-transferable, revocable license to access certain virtual features of the Platform.
              </p>
              <p style={bodyText}>
                CS:GO/CS2 skin deposits are converted to Gems at the Platform's prevailing conversion rate, which is based on 
                external market data and may fluctuate. Gems obtained through skin deposits can only be used within the Platform 
                and can be withdrawn back as CS:GO/CS2 skins (subject to availability, trade restrictions, and withdrawal fees).
              </p>
              <p style={bodyText}>
                The Company reserves the right to adjust conversion rates, fees, and available withdrawal items at any time 
                without prior notice. Withdrawals are subject to processing times, Steam trade restrictions, and may be 
                delayed during periods of high volume.
              </p>

              <h2 style={sectionTitle}>5. Deposits</h2>
              <p style={bodyText}>
                Deposits are made by sending CS:GO/CS2 skins or items to our designated Steam trade bot accounts. 
                Upon receipt and verification, the equivalent value in Gems is credited to your account. The Company 
                reserves the right to:
              </p>
              <ul style={bodyList}>
                <li>Reject or refund any deposit for any reason;</li>
                <li>Adjust the valuation of deposited items based on market conditions;</li>
                <li>Delay crediting of deposits for review of suspicious transactions;</li>
                <li>Require additional verification for high-value deposits.</li>
              </ul>
              <p style={bodyText}>
                All deposit decisions made by the Company are final and binding. Chargebacks, fraudulent deposits, 
                or disputed Steam trade offers will result in immediate account termination and legal action where applicable.
              </p>

              <h2 style={sectionTitle}>6. Withdrawals</h2>
              <p style={bodyText}>
                Gems can be withdrawn as CS:GO/CS2 skins from our bot inventory at the current conversion rate. 
                Withdrawals are subject to the following conditions:
              </p>
              <ul style={bodyList}>
                <li>A minimum withdrawal amount may apply;</li>
                <li>All withdrawals are subject to availability of items in the bot inventory;</li>
                <li>Withdrawals are processed after a mandatory review period to ensure fair play and detect abuse;</li>
                <li>The Company reserves the right to deny any withdrawal request if fraudulent activity is suspected;</li>
                <li>Withdrawal fees may apply as disclosed at the time of withdrawal;</li>
                <li>You must have an active, non-limited Steam account with a valid trade URL.</li>
              </ul>
              <p style={bodyText}>
                The Company is not responsible for Steam trade holds, Steam account limitations, or any issues arising 
                from Steam's trade system. Withdrawal processing times are estimates and not guaranteed.
              </p>

              <h2 style={sectionTitle}>7. Fairness & Provably Fair Gaming</h2>
              <p style={bodyText}>
                All games on the Platform utilize server-seeded random number generation. Certain games employ a 
                provably fair system where the outcome can be independently verified. Detailed fairness documentation 
                is available on the Platform.
              </p>
              <p style={bodyText}>
                The house edge varies by game and is clearly disclosed. Users acknowledge that all games involve 
                risk of losing virtual currency and that the Platform is not responsible for any losses incurred.
              </p>

              <h2 style={sectionTitle}>8. Prohibited Conduct</h2>
              <p style={bodyText}>The following activities are strictly prohibited:</p>
              <ul style={bodyList}>
                <li>Using automated bots, scripts, or any form of automation to interact with the Platform;</li>
                <li>Exploiting bugs, glitches, or vulnerabilities for personal gain;</li>
                <li>Manipulating game outcomes through any means;</li>
                <li>Engaging in any form of money laundering or illegal activity;</li>
                <li>Using multiple accounts to abuse bonuses, promotions, or referral programs;</li>
                <li>Harassing, threatening, or abusing other users or staff;</li>
                <li>Attempting to access, modify, or interfere with the Platform's servers or infrastructure;</li>
                <li>Reverse engineering, decompiling, or disassembling any part of the Platform;</li>
                <li>Using VPNs or proxies to circumvent geographic restrictions;</li>
                <li>Chargeback, reversing, or disputing Steam trade offers or payments.</li>
              </ul>
              <p style={bodyText}>
                Violation of any prohibited conduct will result in immediate and permanent account termination, 
                forfeiture of all virtual balances, and potential legal action. The Company reserves the right 
                to report illegal activity to relevant authorities.
              </p>

              <h2 style={sectionTitle}>9. Promotions & Bonuses</h2>
              <p style={bodyText}>
                All promotions, bonuses, free cases, and affiliate rewards are subject to specific terms disclosed 
                with each promotion. The Company reserves the right to modify, suspend, or cancel any promotion 
                at any time without prior notice.
              </p>
              <p style={bodyText}>
                Abuse of promotions (including but not limited to creating multiple accounts for bonus collection, 
                bonus hunting, or exploiting promotional mechanics) will result in forfeiture of all promotional 
                rewards and potential account termination.
              </p>
              <p style={bodyText}>
                Free daily cases and welcome cases are provided at the sole discretion of the Company and may be 
                discontinued or modified at any time.
              </p>

              <h2 style={sectionTitle}>10. Affiliate Program</h2>
              <p style={bodyText}>
                The affiliate program allows users to earn commissions by referring new users to the Platform. 
                Affiliate commissions are credited in Gems and have no real-world value. The Company reserves 
                the right to:
              </p>
              <ul style={bodyList}>
                <li>Modify commission rates at any time;</li>
                <li>Withhold commissions from accounts engaged in fraudulent or self-referral activity;</li>
                <li>Terminate affiliate accounts for violation of these Terms;</li>
                <li>Claw back commissions if a referred user's account is terminated for fraud.</li>
              </ul>

              <h2 style={sectionTitle}>11. Termination</h2>
              <p style={bodyText}>
                The Company reserves the right to suspend or terminate any account at any time, with or without cause, 
                with or without notice. Grounds for termination include but are not limited to violation of these Terms, 
                illegal activity, or conduct deemed harmful to the Platform or its community.
              </p>
              <p style={bodyText}>
                Upon termination for violation of these Terms, all virtual balances, Gems, and items associated with 
                the account are forfeited without compensation. Users may request account deletion by contacting support; 
                upon deletion, all virtual balances are forfeited.
              </p>
              <p style={bodyText}>
                You may terminate your account at any time by ceasing use of the Platform. However, you will not be 
                entitled to a refund or compensation for any unused Gems or virtual items.
              </p>

              <h2 style={sectionTitle}>12. Limitation of Liability</h2>
              <p style={bodyText}>
                To the maximum extent permitted by applicable law, the Company, its officers, directors, employees, 
                and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, 
                including but not limited to loss of profits, data, use, goodwill, or other intangible losses, resulting from:
              </p>
              <ul style={bodyList}>
                <li>Your use or inability to use the Platform;</li>
                <li>Any conduct or content of any third party on the Platform;</li>
                <li>Unauthorized access to or alteration of your transmissions or data;</li>
                <li>Statements or conduct of any third party on the Platform;</li>
                <li>Any loss of virtual items, Gems, or account access due to technical failures, Steam issues, or user error.</li>
              </ul>
              <p style={bodyText}>
                In no event shall the Company's total liability to you exceed the total value of Gems you have deposited 
                on the Platform in the 30 days preceding the claim. The virtual items and Gems on the Platform are provided 
                "as is" without warranty of any kind.
              </p>

              <h2 style={sectionTitle}>13. Disclaimer of Warranties</h2>
              <p style={bodyText}>
                The Platform is provided on an "as is" and "as available" basis without any representations or warranties, 
                express or implied. The Company does not warrant that:
              </p>
              <ul style={bodyList}>
                <li>The Platform will be uninterrupted, timely, secure, or error-free;</li>
                <li>The results obtained from using the Platform will be accurate or reliable;</li>
                <li>Any errors or defects will be corrected;</li>
                <li>The Platform is free of viruses or other harmful components.</li>
              </ul>

              <h2 style={sectionTitle}>14. Indemnification</h2>
              <p style={bodyText}>
                You agree to indemnify, defend, and hold harmless the Company, its affiliates, officers, directors, 
                employees, and agents from and against any and all claims, liabilities, damages, losses, costs, expenses, 
                or fees (including reasonable attorneys' fees) arising from:
              </p>
              <ul style={bodyList}>
                <li>Your use of the Platform;</li>
                <li>Your violation of these Terms;</li>
                <li>Your violation of any rights of any third party;</li>
                <li>Any content you submit or transmit through the Platform.</li>
              </ul>

              <h2 style={sectionTitle}>15. Governing Law & Disputes</h2>
              <p style={bodyText}>
                These Terms shall be governed by and construed in accordance with the laws of the Republic of Cyprus, 
                without regard to its conflict of law provisions. Any disputes arising from these Terms or the use of 
                the Platform shall be resolved through binding arbitration in accordance with the rules of the 
                International Chamber of Commerce (ICC).
              </p>
              <p style={bodyText}>
                You agree that any cause of action arising out of or related to the Platform must commence within 
                one (1) year after the cause of action accrues; otherwise, such cause of action is permanently barred.
              </p>
              <p style={bodyText}>
                Class action waiver: Any proceedings to resolve disputes will be conducted on an individual basis. 
                Neither you nor the Company will seek to have any dispute heard as a class action or in any other 
                proceeding in which either party acts or proposes to act in a representative capacity.
              </p>

              <h2 style={sectionTitle}>16. Steam & Third-Party Services</h2>
              <p style={bodyText}>
                The Platform integrates with Steam, a service provided by Valve Corporation. Your use of Steam is 
                governed by the Steam Subscriber Agreement and Valve's privacy policies. The Company is not affiliated 
                with, endorsed by, or associated with Valve Corporation. CS:GO and CS2 are registered trademarks of 
                Valve Corporation.
              </p>
              <p style={bodyText}>
                The Platform may integrate with other third-party services. The Company is not responsible for the 
                availability, accuracy, or functionality of any third-party services.
              </p>

              <h2 style={sectionTitle}>17. No Gambling Representation</h2>
              <p style={bodyText}>
                The Platform is a skill-based and chance-based entertainment service that uses virtual items with no 
                real-world monetary value. Skins and Gems are virtual items that cannot be redeemed for cash. 
                The Platform is not a gambling operator and does not facilitate real-money gambling. Any suggestion 
                otherwise is expressly disclaimed.
              </p>
              <p style={bodyText}>
                Users participate in games solely for entertainment purposes. The Company makes no representation 
                that any particular outcome will occur, and users should not participate with the expectation of 
                generating income or profit.
              </p>

              <h2 style={sectionTitle}>18. Entire Agreement</h2>
              <p style={bodyText}>
                These Terms, together with the Privacy Policy, constitute the entire agreement between you and the 
                Company regarding the use of the Platform and supersede any prior agreements or understandings.
              </p>

              <h2 style={sectionTitle}>19. Contact</h2>
              <p style={bodyText}>
                For questions, concerns, or legal requests regarding these Terms, please contact us through the 
                Platform's support channels or via email at the address provided on the Platform.
              </p>
            </div>
          ) : (
            <div>
              <h2 style={sectionTitle}>1. Introduction</h2>
              <p style={bodyText}>
                This Privacy Policy explains how csmolly.bet ("we," "us," or "our") collects, uses, stores, protects, 
                and shares your personal information when you use our platform and services. We are committed to 
                protecting your privacy and handling your information in a transparent and secure manner.
              </p>
              <p style={bodyText}>
                By creating an account and using the Platform, you consent to the collection and use of information 
                as described in this Privacy Policy. If you do not agree with any part of this policy, you should 
                not use the Platform.
              </p>

              <h2 style={sectionTitle}>2. Information We Collect</h2>
              
              <h3 style={subTitle}>2.1 Information You Provide</h3>
              <ul style={bodyList}>
                <li><strong>Account Information:</strong> When you register via Steam OpenID, we collect your Steam ID, 
                Steam username, and Steam avatar URL;</li>
                <li><strong>Age Verification:</strong> Your date of birth, which we collect to verify you meet our 
                18+ age requirement;</li>
                <li><strong>Communication:</strong> Information you provide when contacting support, including your 
                email address and message contents;</li>
                <li><strong>Trade URL:</strong> Your Steam Trade URL, which you may optionally provide for 
                withdrawal processing.</li>
              </ul>

              <h3 style={subTitle}>2.2 Information Collected Automatically</h3>
              <ul style={bodyList}>
                <li><strong>Usage Data:</strong> Pages visited, games played, time spent on the Platform, clicks, 
                and interactions with features;</li>
                <li><strong>Device Information:</strong> IP address, browser type and version, operating system, 
                device type, and screen resolution;</li>
                <li><strong>Transaction Data:</strong> Deposit and withdrawal history, game outcomes, 
                and balance changes;</li>
                <li><strong>Cookies & Similar Technologies:</strong> Information collected via cookies, 
                local storage, and similar tracking technologies (see Section 5).</li>
              </ul>

              <h2 style={sectionTitle}>3. How We Use Your Information</h2>
              <p style={bodyText}>We use the collected information for the following purposes:</p>
              <ul style={bodyList}>
                <li><strong>Service Delivery:</strong> To create and manage your account, process deposits and withdrawals, 
                facilitate gameplay, and provide customer support;</li>
                <li><strong>Age Verification:</strong> To verify that you meet the minimum age requirement 
                to use the Platform;</li>
                <li><strong>Fraud Prevention:</strong> To detect, prevent, and investigate fraudulent activity, 
                abuse, or violation of our Terms of Service;</li>
                <li><strong>Platform Improvement:</strong> To analyze usage patterns, improve our services, 
                and develop new features;</li>
                <li><strong>Communication:</strong> To respond to your inquiries, send service-related notifications, 
                and provide support;</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, legal processes, 
                or governmental requests;</li>
                <li><strong>Affiliate Tracking:</strong> To track referrals and calculate affiliate commissions 
                in accordance with our Affiliate Program.</li>
              </ul>

              <h2 style={sectionTitle}>4. Information Sharing & Disclosure</h2>
              <p style={bodyText}>
                We do not sell, trade, or rent your personal information to third parties. We may share information 
                only in the following circumstances:
              </p>
              <ul style={bodyList}>
                <li><strong>Service Providers:</strong> With trusted third-party service providers who assist us in 
                operating the Platform (e.g., hosting providers, analytics services). These providers are contractually 
                bound to protect your information and use it only for the services we request;</li>
                <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental regulation, 
                or to protect our rights, property, or safety, or the rights, property, or safety of others;</li>
                <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, reorganization, 
                or sale of assets, your information may be transferred as part of that transaction;</li>
                <li><strong>Steam:</strong> Your Steam ID and username are visible to other users of the Platform 
                as part of normal operation (e.g., leaderboards, game participation);</li>
                <li><strong>Aggregated Data:</strong> We may share anonymized, aggregated data that cannot reasonably 
                be used to identify you.</li>
              </ul>

              <h2 style={sectionTitle}>5. Cookies & Tracking Technologies</h2>
              <p style={bodyText}>
                We use cookies and similar tracking technologies to enhance your experience, analyze usage, and 
                provide essential functionality. Specifically, we use:
              </p>
              <ul style={bodyList}>
                <li><strong>Essential Cookies:</strong> Required for the Platform to function, including authentication 
                tokens and session management;</li>
                <li><strong>Analytics Cookies:</strong> To understand how users interact with the Platform, 
                which helps us improve features and performance;</li>
                <li><strong>Local Storage:</strong> To store user preferences (e.g., sound settings, sidebar state) 
                and cached data for improved performance.</li>
              </ul>
              <p style={bodyText}>
                You can control cookie preferences through your browser settings. However, disabling essential cookies 
                may prevent the Platform from functioning properly. We do not use cookies for targeted advertising.
              </p>

              <h2 style={sectionTitle}>6. Data Storage & Security</h2>
              <p style={bodyText}>
                We implement industry-standard security measures to protect your information, including:
              </p>
              <ul style={bodyList}>
                <li>Encryption of data in transit using TLS/SSL protocols;</li>
                <li>Secure, hashed storage of sensitive information;</li>
                <li>Regular security audits and vulnerability assessments;</li>
                <li>Access controls restricting internal access to personal data;</li>
                <li>Firewalls and intrusion detection systems.</li>
              </ul>
              <p style={bodyText}>
                While we strive to protect your information, no method of electronic storage or transmission is 
                100% secure. We cannot guarantee absolute security and encourage you to take precautions to protect 
                your own information (e.g., using strong passwords, enabling Steam Guard).
              </p>

              <h2 style={sectionTitle}>7. Data Retention</h2>
              <p style={bodyText}>
                We retain your personal information for as long as your account is active or as needed to provide 
                services. After account closure, we may retain certain information for a reasonable period to:
              </p>
              <ul style={bodyList}>
                <li>Comply with legal obligations (e.g., anti-money laundering record-keeping);</li>
                <li>Resolve disputes and enforce our Terms of Service;</li>
                <li>Prevent fraud and abuse (e.g., preventing banned users from re-registering).</li>
              </ul>
              <p style={bodyText}>
                Specifically, we retain balance history and transaction records for a minimum of 5 years to comply 
                with applicable financial regulations. Anonymized or aggregated data may be retained indefinitely.
              </p>

              <h2 style={sectionTitle}>8. Your Rights</h2>
              <p style={bodyText}>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
              <ul style={bodyList}>
                <li><strong>Access:</strong> Request a copy of the personal data we hold about you;</li>
                <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete data;</li>
                <li><strong>Deletion:</strong> Request deletion of your personal data, subject to legal retention obligations;</li>
                <li><strong>Restriction:</strong> Request restriction of processing under certain circumstances;</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service provider, where technically feasible;</li>
                <li><strong>Objection:</strong> Object to processing based on legitimate interests, including data used for analytics;</li>
                <li><strong>Withdrawal of Consent:</strong> Withdraw consent at any time where processing is based on consent.</li>
              </ul>
              <p style={bodyText}>
                To exercise any of these rights, please contact us through the Platform's support channels. We will respond 
                within 30 days. We may need to verify your identity before processing your request.
              </p>

              <h2 style={sectionTitle}>9. Third-Party Services</h2>
              <p style={bodyText}>
                The Platform integrates with the following third-party services:
              </p>
              <ul style={bodyList}>
                <li><strong>Steam (Valve Corporation):</strong> For authentication, profile information, and trade processing. 
                Your use of Steam is governed by the Steam Subscriber Agreement and Valve's Privacy Policy;</li>
                <li><strong>Cloudflare:</strong> For content delivery, DDoS protection, and performance optimization. 
                Cloudflare may process certain connection metadata;</li>
                <li><strong>Buff163 / Market APIs:</strong> For skin pricing data. No personal information is shared 
                with these services.</li>
              </ul>
              <p style={bodyText}>
                We are not responsible for the privacy practices of third-party services. We encourage you to review 
                their privacy policies before using them.
              </p>

              <h2 style={sectionTitle}>10. International Data Transfers</h2>
              <p style={bodyText}>
                Your information may be stored and processed in any country where we or our service providers maintain 
                facilities. By using the Platform, you consent to the transfer of your information to countries outside 
                your country of residence, which may have different data protection laws.
              </p>
              <p style={bodyText}>
                When we transfer your data internationally, we ensure appropriate safeguards are in place, including 
                Standard Contractual Clauses or equivalent mechanisms, to protect your information in accordance with 
                this Privacy Policy.
              </p>

              <h2 style={sectionTitle}>11. Children's Privacy</h2>
              <p style={bodyText}>
                The Platform is not intended for individuals under the age of 18. We do not knowingly collect personal 
                information from minors. If we become aware that a minor has provided us with personal information, 
                we will take steps to delete such information and terminate the associated account. If you believe 
                we have collected information from a minor, please contact us immediately.
              </p>

              <h2 style={sectionTitle}>12. Changes to This Privacy Policy</h2>
              <p style={bodyText}>
                We may update this Privacy Policy from time to time to reflect changes in our practices, legal 
                requirements, or industry standards. Material changes will be communicated through the Platform 
                or via email. The "Last updated" date at the top of this page indicates when the policy was 
                last revised. Your continued use of the Platform after changes constitutes acceptance of the 
                updated policy.
              </p>

              <h2 style={sectionTitle}>13. Contact & Complaints</h2>
              <p style={bodyText}>
                If you have questions, concerns, or complaints regarding this Privacy Policy or our data practices, 
                please contact us through the Platform's support channels.
              </p>
              <p style={bodyText}>
                You also have the right to lodge a complaint with your local data protection authority if you believe 
                your privacy rights have been violated. We encourage you to contact us first so we can attempt to 
                resolve your concern directly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
