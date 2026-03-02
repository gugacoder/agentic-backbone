<?php

/**
 * Adminer auto-login plugin for dev environment.
 *
 * Reads POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB from env vars
 * and pre-fills the login form so the user just clicks "Login".
 */

class AdminerAutoLogin
{
    /** Accept any credentials (dev only). */
    function login($login, $password)
    {
        return true;
    }

    /** Pre-fill login form fields from environment variables. */
    function loginForm()
    {
        $host = getenv('POSTGRES_HOST') ?: 'postgres.internal';
        $user = getenv('POSTGRES_USER') ?: 'postgres';
        $pass = getenv('POSTGRES_PASSWORD') ?: '';
        $db   = getenv('POSTGRES_DB') ?: 'postgres';

        echo '<table cellspacing="0" class="layout">';
        echo '<tr><th>System<td><select name="auth[driver]"><option value="pgsql" selected>PostgreSQL</option></select>';
        echo '<tr><th>Server<td><input type="text" name="auth[server]" value="' . htmlspecialchars($host) . '" title="hostname[:port]" placeholder="localhost" autocapitalize="off">';
        echo '<tr><th>Username<td><input type="text" name="auth[username]" value="' . htmlspecialchars($user) . '" id="username" autocomplete="username" autocapitalize="off">';
        echo '<tr><th>Password<td><input type="password" name="auth[password]" value="' . htmlspecialchars($pass) . '" autocomplete="current-password">';
        echo '<tr><th>Database<td><input type="text" name="auth[db]" value="' . htmlspecialchars($db) . '" autocapitalize="off">';
        echo '</table>';
        echo '<p><input type="submit" value="Login">';
        return true;
    }
}

return new AdminerAutoLogin();
