# DDoS Attack Evidence — Vercel Billing Review

**Project:** `quitccp` · tuidang.org
**Team:** johns-projects-5af7dbd8
**Organization:** Global Service Center for Quitting the CCP — a 501(c)(3) nonprofit, New York
**Attack began:** 13 October 2026
**Evidence collected:** 14 October 2026, 16:41 UTC, from Vercel's own firewall analytics (`vercel firewall` CLI)

---

## 1. Summary

Over a rolling 25-hour window, Vercel's firewall processed **4.2 billion requests** against this
project. **0.19% were allowed.** The remainder were challenged or denied by Vercel's own system
mitigations and by nine custom WAF rules we deployed during the attack.

| Action | Requests | Share |
| --- | --- | --- |
| Challenge | 3,880,200,000 | 95.8% |
| Deny | 167,600,000 | 4.1% |
| **Allow** | **7,300,000** | **0.19%** |
| **Total** | **~4,055,100,000** | |

Peak rate: **348.2 million requests in one hour** (~96,700 requests/second), at 12:00 UTC on 14 October.

This is not organic traffic. Normal allowed traffic for this site is on the order of 1,500–2,000
requests per hour.

---

## 2. Billing impact

Current cycle **11 October – 11 November 2026**. Infrastructure subtotal: **$271.41**, essentially
all of it incurred on **12–14 October**. The remaining 28 days of the cycle are near zero.

| Product | Usage | Charge |
| --- | --- | --- |
| Firewall Rate Limit Requests | 134.61M | **$88.11** |
| CDN Requests | 32.81M (10M included) | **$59.20** |
| Fluid Active CPU | 456 hours | **$58.39** |
| Fluid Provisioned Memory | 3.41K GB-Hrs | **$36.21** |
| Fast Origin Transfer | 192 GB | $13.62 |
| Function Invocations | 22.39M | $13.43 |
| CDN Requests — Additional CPU Duration | 4 hours | $1.74 |
| ISR Writes | 143.58K | $0.57 |
| ISR Reads | 270.82K | $0.11 |
| Build CPU Minutes | 6 hours | $0.02 |
| Fast Data Transfer | 145 GB (1 TB included) | $0.00 |
| **Infrastructure subtotal** | | **$271.41** |

The daily consumption chart shows three bars (12, 13, 14 October) against 28 empty days. The shape
of the bill is the shape of the attack.

---

## 3. DDoS mitigation episodes raised by Vercel's own system

Sixteen episodes in 24 hours, all raised and resolved by `sys_dos_mitigation`:

      Status     Alert             Detail                           Requests   Started                Age   Id
      Resolved   DDoS Mitigation   System rule · Deny · Challenge     360.1M   Oct 14 12:15 UTC    4h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791980100000
      Resolved   DDoS Mitigation   System rule · Challenge            151.5M   Oct 14 11:30 UTC    5h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791977400000
      Resolved   DDoS Mitigation   System rule · Challenge            143.7M   Oct 14 11:00 UTC    5h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791975600000
      Resolved   DDoS Mitigation   System rule · Challenge            138.2M   Oct 14 10:30 UTC    6h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791973800000
      Resolved   DDoS Mitigation   System rule · Challenge            173.4M   Oct 14 09:30 UTC    7h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791970200000
      Resolved   DDoS Mitigation   System rule · Challenge            141.4M   Oct 14 09:00 UTC    7h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791968400000
      Resolved   DDoS Mitigation   System rule · Deny                   1.7M   Oct 14 08:00 UTC    8h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791964800000
      Resolved   DDoS Mitigation   System rule · Deny                   6.7M   Oct 14 07:30 UTC    9h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791963000000
      Resolved   DDoS Mitigation   System rule · Challenge             89.1M   Oct 14 07:00 UTC    9h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791961200000
      Resolved   DDoS Mitigation   System rule · Deny                 748.8k   Oct 14 06:00 UTC   10h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791957600000
      Resolved   DDoS Mitigation   System rule · Deny                   1.6M   Oct 14 05:00 UTC   11h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791954000000
      Resolved   DDoS Mitigation   System rule · Deny                   5.8M   Oct 14 04:15 UTC   12h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791951300000
      Resolved   DDoS Mitigation   System rule · Deny · Challenge     255.4M   Oct 13 21:15 UTC   19h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791926100000
      Resolved   DDoS Mitigation   System rule · Deny · Challenge      53.1M   Oct 13 19:45 UTC   20h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791920700000
      Resolved   DDoS Mitigation   System rule · Deny · Challenge      32.3M   Oct 13 17:45 UTC   22h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791913500000
      Resolved   DDoS Mitigation   System rule · Challenge             60.7M   Oct 13 17:00 UTC   23h ago   team_NkiuuhFuTfBWNn43DAc1oMNL-prj_oOVviTSZnJf7Ica9ZCt3DfNjTY2D-1791910800000
    

---

## 4. Attack composition

      Top IPs
      176.111.37.5      46.2M
      34.143.33.137     41.4M
      34.143.51.195     40.9M
      35.235.153.76     39.0M
      103.237.102.191   38.0M
    
      Top JA4 Digests
      t13d1511h2_8daaf6152771_5b3554b5c573   2606.2M
      t13d1516h2_8daaf6152771_02713d6af862    741.9M
      t13d1516h2_8daaf6152771_d8a2da3f94cd    277.4M
      t13d0912h2_f91f431d341e_2c481c11c48b    116.5M
      t13d1513h2_8daaf6152771_b17c474a414d    108.7M
    
      Top AS Names
      3xK Tech GmbH (200373)              2870.9M
      Google LLC (396982)                  140.9M
      Cogento Backbone Limited (214743)     82.0M
      OVH SAS (16276)                       45.4M
      Contabo GmbH (51167)                  42.1M
    
      Top User Agents
      Mozilla/5.0 (Windows NT 10.0; …hrome/121.0.0.0 Safari/537.36   2609.4M
      Mozilla/5.0 (Windows NT 10.0; …hrome/133.0.0.0 Safari/537.36    264.8M
      Mozilla/5.0 (Windows NT 10.0; …hrome/136.0.0.0 Safari/537.36    245.9M
      Mozilla/5.0 (Windows NT 10.0; …hrome/134.0.0.0 Safari/537.36    245.7M
      Mozilla/5.0 (Windows NT 10.0; …hrome/135.0.0.0 Safari/537.36    245.7M
    
      Top Request Paths
      /news/陈思敏：一张照片说出薄熙来与两个赌王不能   2072.0M
      /2013/03/04/23836/                               1980.2M
      /                                                  32.9k
      /favicon.ico                                        2.9k
      /logo/banner-2022-1.webp                            2.6k
    
      Rules
      DDoS Mitigation                            3929.2M
      Challenge attacked article                   33.8M
      Challenge legacy URL of attacked article     29.2M
      Bot Protection                               21.9M
      Challenge secondary attack JA4               11.2M
    
      Top Hosts
      www.tuidang.org                                        4055.1M
      quitccp.vercel.app                                       10.5k
      tuidang.org                                               5.7k
      TuiDang.org                                                 13
      quitccp-ds6cfhtvh-johns-projects-5af7dbd8.vercel.app         7
    
      Verified Bots
      amazonbot             10.9k
      googlebot              7.7k
      bingbot                5.1k
      applebot               4.8k
      facebookexternalhit    2.8k
    
      Break any of these values down further:
      vercel firewall traffic inspect <dimension> <value>
    

Notes on the above:

- **A single autonomous system, 3xK Tech GmbH (AS200373), accounts for 2.87 billion requests.**
- **A single TLS fingerprint accounts for 2.6 billion requests.** Real browser populations do not
  concentrate like this.
- **A single 2013 article received 2.07 billion requests.** It is a piece about a Chinese political
  figure. The attack is targeted, not opportunistic.
- The top five source IPs are all blocked by us and still appear at the top of the traffic table —
  i.e. they are still attacking and being denied.

---

## 5. What we did about it, during the attack

We did not leave this running. Within hours of onset we deployed:

      Custom
    
        #   Name                                     Action                 Status
        1   Block attack JA4                         Deny                   Enabled
            rule_block_attack_ja_4_4nN9Mh
        2   Block attack ASN 200373                  Deny                   Enabled
            rule_block_attack_asn_200373_zgYieE
        3   Rate limit per IP                        Rate Limit (300/60s)   Enabled
            rule_rate_limit_per_ip_j257ou
        4   Deny POST HEAD on content                Deny                   Enabled
            rule_deny_post_head_on_content_ZYO0hC
        5   Deny cache-buster rnd param              Deny                   Enabled
            rule_deny_cache_buster_rnd_param_OoraaF
        6   Challenge attacked article               Challenge              Enabled
            rule_challenge_attacked_article_YhSLIg
        7   Challenge secondary attack JA4           Challenge              Enabled
            rule_challenge_secondary_attack_ja_4_dVsHan
        8   Challenge legacy URL of attacked arti…   Challenge              Enabled
            rule_challenge_legacy_url_of_attacked_article_3XDUxn
        9   Rate limit search per IP                 Rate Limit (20/60s)    Enabled
            rule_rate_limit_search_per_ip_s1PJke
    
      Showing live configuration.
    

Plus:

- **Bot Protection** set to Challenge (21.9M requests mitigated)
- **Five IP blocks** covering every top attacking address
- **Statically generated every content route** so that allowed traffic is served from cache rather
  than from functions and the database
- **Per-IP rate limiting**, site-wide and a tighter one on the search page
- **A 5-second database statement ceiling** on the one expensive query, so a reader's search cannot
  hold a database connection open
- **`maxDuration` caps** on all eight public routes that touch the database

The result is visible above: allowed traffic is 0.19% of inbound, and the site has stayed up.

---

## 6. What we are asking for

In order of preference:

1. **A credit for the attack-driven usage of 12–14 October.**
2. Failing that, **a partial credit for the WAF-related lines** — the Firewall Rate Limit Requests
   line alone is $88.11, incurred evaluating traffic that Vercel's own firewall then mitigated.
3. **Guidance on whether we qualify for Vercel's nonprofit or open-source program**, so that a
   future attack of this scale does not threaten our ability to stay online.

We are not asking Vercel to absorb the cost of our own misconfiguration. We are asking for relief
from a politically motivated attack on a nonprofit that documents human-rights abuses.

We can provide the full firewall analytics export, our complete rule configuration, and our
501(c)(3) determination letter on request.
