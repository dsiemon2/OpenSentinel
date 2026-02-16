# Email DNS Records — SPF & DKIM Setup for GoDaddy

**Server IP:** `74.208.129.33`
**Generated:** 2026-02-14
**Nameservers:** ns17.domaincontrol.com / ns18.domaincontrol.com (GoDaddy)

> For each domain below, add the listed TXT records in GoDaddy DNS Management.
> Domains already fully configured (SPF + DKIM in DNS) are not listed.

---

## Already Complete (No Action Needed)

These domains already have both SPF and DKIM DNS records:

- mangydogcoffee.com
- gogreenworkflowhub.com
- gogreenaiconcierge.com
- gogreensourcingai.com
- thesoupcookoff.com

---

## opensentinel.ai — Needs SPF Only

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |

---

## gogreenpaperlessinitiative.com — Needs DKIM Only

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAriS2PfxtMO/mpc/koDVehVTvWCeGLgC+7Clx6XLpJnfXSTOODPA0dnAN1Laon4/qow26Jx0VcLDSl38HPR40+nrEOebzPD1NQBLo8hVJunb1k/ueBA9ZyUbebmdrDwHXQjpCINUdzG6yxkzmLGgLDcOGvcvJWuZDcz7fWihz4igS0ty9la1A6VD0xLC/yORaNwVprhfEUYtjQEaj9hKqzE19ZtfVj+4PMBTEfopEglIXftFoBQqqzsc+7VcQIaAUC776Ov+xwDGkzR4fz0qd3PUWp03vxP8HZsFCgCxRngmc4gWEBMJzDCCL7wheYkZ0BvDnwX+76zLOj43j3dfohQIDAQAB` | 600 |

---

## tutorableai.com — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoYdEy94pZKD1Rfbj+1RaktL2+BGIwwwCS5mK6xBz/4xROpyw3umSqcZf/WbH/r+InG7nW8znyXh1MvUgBgXZst3GIPDzmP8LE3hIMI0WMylRJUlSEFYeHnjKgn4dHXXxyqveNSPy9i4ONnNbASQutBK9KJL9hyRI7ndmbOQmMiYuExWOAA2J2vZlBdjYb/5bAWvm2pg/4ASPag5m+7g0199x9MclGQCzuLhCcJzOvU33Rbcs6Unk3q4Oer6a4HtXO//Mv5sRQUpx77VzRPVwiu9JkgPqoYxyRu5CClavQo6/gyGPY0hWumsHNuVQNnS6ISE/BdAU/MijT9rBYC9c+wIDAQAB` | 600 |

---

## maximuspetstore.com — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnpR/eQ+wQOlIRbWz8vcwyh+r3kuuge42nRTZJ1wlG8WMVt+zWfJtBSsSHckQ453r0ly+G1OhkOYjgL+VstKq2trd7yeD1nKtb20FWwam2RP6JrZDq6Mo+maTAjF1dqpGkPNpR4ShaKjrx4iAtm0/03XuYpDXToNN+lN4/MW0itQ2Aaegln46t+NeaPWQ5unfp8W7+2vvHWQKR0rX1sxn2Lmg+9SlZ0zskGUgTsA9xMtYKuoF3Pb4jx+dVbacSjvjZef87hVlh85rJIwxVZItVaE0r3hD1mb6X8GPMA30XmesnO92aRaNuezEuxCOnxj5MQjill9818QSYSRdME2q1wIDAQAB` | 600 |

---

## pecosrivertraders.com — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz0bxIR0h6nuLW87G4mEEA7x0yH4xHG4DbZ409yOYRVCenxvOtOYEFa6E0yBra1C+qQAi7UvREnNBh4obDuOw9ewLOM/DtSUdEy2ROcIw7Sva/EY2PJ051gsFhB5CbRgL/77ziwK2rqUZyc7ed1tYl4//SegPM5seYNfn7lVLc4XXb2zSoe5tajd6nldqej2rjGJIVmvTTvaZtvjkTRtZ6GzVGgIngvUtg4f+8CxOMOx8OqmqH8NG/P81SbwxnusWOBnbPo7QjVslXCwyxYdr89a9v1JDLRRAzI+3Q/Sr61X2/t/2yReawvhD4RrcLrjks2ZeW4pr/SeNzRVYH92rVwIDAQAB` | 600 |

---

## naggingwifeai.com — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmVm3qYX5B9TImX4rDMOYAUawdBT574jaC/7Bf/FQeYy547LJE4xVoMefT9zxErWbkaYsuEjsdp8r731bVNCdaYntJTSr5bnPdjIYZm2cug2Mpy8355vcst7AuX6MydJlLLx8aE2pLKDF7RhM5d7i50DqGAt8FBjO3Ul8JkR6plDtud3a6LdtwLZu8cHXFJqyjBiY/BOW52mkw1q6Cfo9XZp8oRgl5V7iyILV1DigLM5wuTmqs6O4X+Ah+vlZEoPswBaVx8J/PnxY5enf/+W2HofQ0Iei0ZYcHnMct7prkntkaefZdLs3i+tlXCGzq2varBtk0NQe6J+mIq9IcaMNbQIDAQAB` | 600 |

---

## poligopro.com — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0aAS/Lz5zH5B6sk1LgSyn2IQnE0N26ZekyGJDynquSBdyMxqbngd6utV6T26xZOr0AKX0v+OkxD61sKxVLMH31Solu9jyewBYhJQfb1g642T5Wn8ddyA98bQhcr7/OZ23yiw9XybA5F4e78i5U+1gc9zMCVAjU/aPGZX4vybfeNOXLScSX2oRmSqlTU824TzfAh3MhA966lwi4Mm1JhSjYaEyHnbYd2Qg/D+Old0VqTSNtj2D6zOwQrBhGehq8Ic9ezrsr3MQ3Ie+owMUMA4uwmv5GgT95IeTF8Byk6SRTVPEoNZzxqitdGiBfKi/HvA3fLpzOH5BSWdNEiqaP1y2QIDAQAB` | 600 |

---

## sellmeapen.net — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuvhLpzKz5FNiGabYBZyCrTt7xCo2sn1yRCW5ZDs/zWAS5WkCnVOi50Mkl8BaVtBJMMGeSTfXZsq17QvM8NlDuuucXrr9b28wLELZWGg5XrHc8nXK8YFzq2nKj9g8QzleKhGQtuFjfpyWI8s7vU7GqR1M5/COAOZLY9ZPo86xbC90xMazXvXu16CFhZEjbMW386c3FUgIdJu7QL6vUCNCnEJiX6ObvQgxC0R0WQLNLak6die6mCfIIAu157eZabb8tBfIPNSoCXxRyRP/+VlRXwyTY4PuxJbOjlSa1/Qkq7V5PzCw6MzaQ4XeiulB/nUsGglJOMvd3kkcoZ4W/DRMTQIDAQAB` | 600 |

---

## recruitabilityai.com — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtvUAwRYhZ1Nb7bVTogM+mVwKN5EQH4qpivTrJm5awk3Q3UaAJESinRIq2ZWiDsktQ+mC/4/7kKyfmzkzg72qEGwBoZyu+r1EegSAEKxlj8pLz21tz6duMt4Z0r5PwWIwDr3xsh/nc7EfjqzrVVMUAYdGaIFKFe6s4x8EPyQJQEYZPItpeUb61ZG10hlZqSY0iQBh0Df3wWbHoMTeZnzBtJfTnSyh7kSz3YtE6GNXi9Gri+JDxxkVH1a/kBtE1OnEfma8YHtZDxlXhaX5xhX9ktqYKtRrepDi66KX/N/gTj3050xBmg4RAHkAKZ4W8x5Af07sImORTVEaojSWOYuSqQIDAQAB` | 600 |

---

## lifestyleproai.com — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyr3veF1S+GvaAYsRml5lwgZdXfxhFziPebg8cfH1gaYwpeoIJXrInJ+y7WS4B3wW5UIfpg4c7ARtdmN2BSillnQ+ieeQrmlAD2sz+CMiF13rC3Ok/wWlJNvhlRj/U0UpN1wwrixAgRIdvq4XY07WUYI5VdKxkImVIKANCxs9zklUtmiJ7w54eyIuU0C0tXrNo5Qmj4Nks3t6Ih4oPxe6K/pd8mjf3HFFf1cLw4T1vFkvijdf5OoBvfSMKoGbkEEK2sevl28QLi+6CS9xkcxCL0G2wI3ZzmqBMP+B3dw8HVIi0bVakt+p7lpeO6e/ZB90PD7yeD6WyrjvlXIW1dYI6wIDAQAB` | 600 |

---

## apexsalestraining.net — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsWU15TOy6HSELxDS3rkLz4reTEx3QIJ5Wm9MouR7gmWSDMt9UknF4Qon/GtW7n4py+7/sSoWgBXm0Q3eJjyOKONZFTGt9Zs7YihPcVGurrror/0czuICDWs21XBIvLGcqlgefqRuEHTI1lNqrEOjFadyWMGy4VLOaB1xWFCz4TEgaED0rANnK+hxCEoqhtOzUDdsUfIAzp1Cq/KFeoKFJ/7W68q+sfmQ7FAgmlSzTvsst8lIBMG8/XDvq7CxTWFvYRgrExfMfbzao3LbYrtK7bt3GN6nHqgIQ6kIKiJhs7dR9qdinxgdJctwpJBpJeM1HLa1M0cAi3nyg+7czPtC4QIDAQAB` | 600 |

---

## votigopro.com — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArtcWyxiwX+i2XipXtCvHnbPb3deyD08p58yiLglBVDABnK8j8dYlseoqMbyr2XYBUf1bQQg1z14JXxcWpl5dGzw56HBJXxVm97PY5JDNMPLPoyBM7m0hQv3AqFIs7rqjc+moFIcnxcHqJAUffNkAxoxCXkcT5vmtGgDsYKlwMRgf/V4AlKVpO8LaBE8BXAswQbWwITg+gb72QEyxYkL82g2pRMBUjec0Z2LkhtTnW2xHHXkIJNMeD7T+CHFRE520UMK/er1bu8oQxQoc8a8MebSctqaM0bCAAmKskdjUdaX7rx+1V8yELh23e0KQfV69L3A7zp2+wBmk2MfrrKxbJwIDAQAB` | 600 |

---

## realestate-markets.info — Needs SPF + DKIM

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` | `v=spf1 ip4:74.208.129.33 ~all` | 600 |
| TXT | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAov8kYkvug+60A6NlwlSyv7BcT+qJCKSQg6OCQrReQJjxfmKRpxEADXFE2KLETxkMn0tDELhmOizAMQvxUFoNmQsTdty6b4HFHkdpt6R/c/JJ8m3/df6XDCHPDQ1CQLfh3moOZFbQkaiXfnZ4lXemmr3WczMkTCt14tzLC9gfPP1ES0eG+GrN9IXS5KDAvDmGxhZ6WhznsxeeYttvB8G46C2TAgaRUyQnSHbpcUXD7tYt0rc+qNPFkRqWWOfik/QestOh0zI5ACA7C52o9zndx5RwZsBWAUVAZescMRjvCsYIu6IW56RI6r3fX6jSsTZZoc+SL39RlYNOh4H44oi0BwIDAQAB` | 600 |

---

## GoDaddy Instructions

1. Log in to [GoDaddy DNS Management](https://dcc.godaddy.com/manage-dns)
2. Select the domain
3. Click **Add New Record**
4. Set **Type** = `TXT`
5. For SPF: Set **Name** = `@`, paste the `v=spf1...` value
6. For DKIM: Set **Name** = `default._domainkey`, paste the `v=DKIM1...` value
7. Set **TTL** = `600` (10 minutes) or `1 Hour` (default)
8. Click **Save**
9. Repeat for each domain

**Important:** When pasting DKIM keys, make sure there are NO spaces or line breaks in the `p=` value. It should be one continuous string.

## Verification

After adding DNS records, verify propagation with:

```bash
# Check SPF
dig TXT example.com +short

# Check DKIM
dig TXT default._domainkey.example.com +short

# Test DKIM key validity (from server)
opendkim-testkey -d example.com -s default -vvv
```

Allow 5-30 minutes for DNS propagation.
