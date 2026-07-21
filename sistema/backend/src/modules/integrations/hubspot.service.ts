import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { CrmContactContract } from './dto/crm-contact.dto'

export interface HubSpotPushResult {
  hubspotId: string
  action: 'created' | 'updated'
}

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name)
  private readonly BASE_URL = 'https://api.hubapi.com'

  private get apiKey(): string {
    return process.env.HUBSPOT_API_KEY || ''
  }

  private get defaultOwnerId(): string {
    return process.env.HUBSPOT_DEFAULT_OWNER_ID || ''
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  async pushContact(contract: CrmContactContract): Promise<HubSpotPushResult> {
    if (!this.isConfigured()) {
      throw new Error('HubSpot não configurado: HUBSPOT_API_KEY ausente.')
    }

    const props: Record<string, string> = {
      firstname: contract.properties.firstname,
      lastname: contract.properties.lastname,
      phone: contract.properties.phone || '',
      lifecyclestage: contract.properties.lifecyclestage,
      cpf_documento: contract.properties.cpf_documento || '',
    }

    if (contract.properties.email) {
      props.email = contract.properties.email
    }

    if (this.defaultOwnerId) {
      props.hubspot_owner_id = this.defaultOwnerId
    }

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }

    if (contract.properties.email) {
      return this.upsertByEmail(contract.properties.email, props, headers)
    }

    return this.createContact(props, headers)
  }

  private async upsertByEmail(
    email: string,
    props: Record<string, string>,
    headers: Record<string, string>,
  ): Promise<HubSpotPushResult> {
    try {
      const searchRes = await axios.post(
        `${this.BASE_URL}/crm/v3/objects/contacts/search`,
        {
          filterGroups: [
            { filters: [{ propertyName: 'email', operator: 'EQ', value: email }] },
          ],
          properties: ['email', 'hs_object_id'],
          limit: 1,
        },
        { headers, timeout: 10000 },
      )

      const results = (searchRes.data?.results ?? []) as Array<{ id: string }>
      if (results.length > 0) {
        const contactId = results[0].id
        await axios.patch(
          `${this.BASE_URL}/crm/v3/objects/contacts/${contactId}`,
          { properties: props },
          { headers, timeout: 10000 },
        )
        return { hubspotId: contactId, action: 'updated' }
      }
    } catch (err) {
      this.logger.warn(`Busca por email falhou no HubSpot: ${(err as Error).message}`)
    }

    return this.createContact(props, headers)
  }

  private async createContact(
    props: Record<string, string>,
    headers: Record<string, string>,
  ): Promise<HubSpotPushResult> {
    const res = await axios.post(
      `${this.BASE_URL}/crm/v3/objects/contacts`,
      { properties: props },
      { headers, timeout: 10000 },
    )
    return { hubspotId: res.data.id as string, action: 'created' }
  }
}
