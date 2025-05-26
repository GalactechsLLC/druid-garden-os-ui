
/**
 * Base user interface from JWT token
 */
export type User = {
    sub: string;
    eml: string;
    rol: string;
    [key: string]: any;
}

/**
 * User details from API
 */
export type UserDetails = {
    id: string;
    username: string;
    email?: string;
    name?: string;
    fullName?: string;
    role: string;
    lastLogin?: string;
    createdAt?: string;
    updatedAt?: string;
    avatar?: string;
    preferences?: Record<string, any>;
    [key: string]: any;
}

/**
 * Password change request
 */
export type PasswordChangeRequest = {
    username: string;
    old_password: string;
    new_password: string;
}

/**
 * Login request
 */
export type LoginRequest = {
    username: string;
    password: string;
}
