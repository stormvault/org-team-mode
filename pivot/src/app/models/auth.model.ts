export type AuthProvider = 'google' | 'password' | 'phone';

export interface FirebaseUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  providerId: AuthProvider;
  phoneMfaLinked: boolean;
  idToken?: string;
}

export interface ProjectMember {
  uid: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedAt: string;
}

export interface CollaborativeProject {
  id: string;
  name: string;
  ownerUid: string;
  members: ProjectMember[];
  orgFiles: string[];
  createdAt: string;
}
