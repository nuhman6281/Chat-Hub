import { box, randomBytes, secretbox } from 'tweetnacl';
import { 
  encodeUTF8, 
  decodeUTF8, 
  encodeBase64, 
  decodeBase64 
} from 'tweetnacl-util';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EncryptedMessage {
  encryptedContent: string;
  nonce: string;
  senderPublicKey: string;
}

export interface UserKeys {
  keyPair: KeyPair;
  publicKeyString: string;
}

class EncryptionService {
  private keyPair: KeyPair | null = null;
  private publicKeyString: string | null = null;

  // Generate a new key pair for the current user
  generateKeyPair(): UserKeys {
    const keyPair = box.keyPair();
    const publicKeyString = encodeBase64(keyPair.publicKey);
    
    this.keyPair = keyPair;
    this.publicKeyString = publicKeyString;
    
    // Store in localStorage for persistence
    localStorage.setItem('userKeyPair', JSON.stringify({
      publicKey: encodeBase64(keyPair.publicKey),
      secretKey: encodeBase64(keyPair.secretKey)
    }));
    
    return {
      keyPair,
      publicKeyString
    };
  }

  // Load existing key pair from localStorage
  loadKeyPair(): UserKeys | null {
    const storedKeys = localStorage.getItem('userKeyPair');
    if (!storedKeys) return null;

    try {
      const parsed = JSON.parse(storedKeys);
      const keyPair: KeyPair = {
        publicKey: decodeBase64(parsed.publicKey),
        secretKey: decodeBase64(parsed.secretKey)
      };
      
      this.keyPair = keyPair;
      this.publicKeyString = parsed.publicKey;
      
      return {
        keyPair,
        publicKeyString: parsed.publicKey
      };
    } catch (error) {
      console.error('Failed to load key pair:', error);
      return null;
    }
  }

  // Get or generate key pair
  getOrCreateKeyPair(): UserKeys {
    const existing = this.loadKeyPair();
    if (existing) return existing;
    
    return this.generateKeyPair();
  }

  // Encrypt a message for a specific recipient
  encryptMessage(message: string, recipientPublicKey: string): EncryptedMessage {
    if (!this.keyPair) {
      throw new Error('No key pair available. Call getOrCreateKeyPair() first.');
    }

    const nonce = randomBytes(box.nonceLength);
    const messageUint8 = encodeUTF8(message);
    const recipientKey = decodeBase64(recipientPublicKey);
    
    const encrypted = box(messageUint8, nonce, recipientKey, this.keyPair.secretKey);
    
    return {
      encryptedContent: encodeBase64(encrypted),
      nonce: encodeBase64(nonce),
      senderPublicKey: this.publicKeyString!
    };
  }

  // Decrypt a message from a sender
  decryptMessage(encryptedMessage: EncryptedMessage): string {
    if (!this.keyPair) {
      throw new Error('No key pair available. Call getOrCreateKeyPair() first.');
    }

    try {
      const encrypted = decodeBase64(encryptedMessage.encryptedContent);
      const nonce = decodeBase64(encryptedMessage.nonce);
      const senderPublicKey = decodeBase64(encryptedMessage.senderPublicKey);
      
      const decrypted = box.open(encrypted, nonce, senderPublicKey, this.keyPair.secretKey);
      
      if (!decrypted) {
        throw new Error('Failed to decrypt message');
      }
      
      return decodeUTF8(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  // Encrypt message for multiple recipients (group chat)
  encryptForGroup(message: string, recipientPublicKeys: string[]): EncryptedMessage[] {
    return recipientPublicKeys.map(publicKey => 
      this.encryptMessage(message, publicKey)
    );
  }

  // Get current user's public key
  getPublicKey(): string | null {
    return this.publicKeyString;
  }

  // Generate a symmetric key for channel encryption
  generateChannelKey(): string {
    const key = randomBytes(secretbox.keyLength);
    return encodeBase64(key);
  }

  // Encrypt message with symmetric key (for channels)
  encryptWithSymmetricKey(message: string, keyString: string): { encrypted: string; nonce: string } {
    const key = decodeBase64(keyString);
    const nonce = randomBytes(secretbox.nonceLength);
    const messageUint8 = encodeUTF8(message);
    
    const encrypted = secretbox(messageUint8, nonce, key);
    
    return {
      encrypted: encodeBase64(encrypted),
      nonce: encodeBase64(nonce)
    };
  }

  // Decrypt message with symmetric key (for channels)
  decryptWithSymmetricKey(encrypted: string, nonce: string, keyString: string): string {
    try {
      const key = decodeBase64(keyString);
      const encryptedData = decodeBase64(encrypted);
      const nonceData = decodeBase64(nonce);
      
      const decrypted = secretbox.open(encryptedData, nonceData, key);
      
      if (!decrypted) {
        throw new Error('Failed to decrypt with symmetric key');
      }
      
      return decodeUTF8(decrypted);
    } catch (error) {
      console.error('Symmetric decryption failed:', error);
      throw new Error('Failed to decrypt message');
    }
  }
}

export const encryptionService = new EncryptionService();