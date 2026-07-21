import { Injectable } from '@nestjs/common'
import axios from 'axios'

@Injectable()
export class ViaCEPService {
  async getAddress(zipCode: string) {
    try {
      const cep = zipCode.replace(/\D/g, '')
      if (cep.length !== 8) {
        throw new Error('CEP inválido')
      }

      const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`)

      if (response.data.erro) {
        throw new Error('CEP não encontrado')
      }

      return {
        street: response.data.logradouro,
        neighborhood: response.data.bairro,
        city: response.data.localidade,
        state: response.data.uf,
        zipCode: zipCode,
      }
    } catch (error) {
      throw new Error(`Erro ao buscar CEP: ${error.message}`)
    }
  }
}
