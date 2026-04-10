package org.CSTI5488.edu.service;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import org.CSTI5488.edu.model.Usuario;
import org.CSTI5488.edu.repository.UsuarioRepository;
import org.mindrot.jbcrypt.BCrypt;

import java.util.Date;

public class AuthService {

    private static final long EXPIRACION_MS = 24 * 60 * 60 * 1000L; // 24 horas

    private final UsuarioRepository usuarioRepository;
    private final String jwtSecret;

    public AuthService() {
        this.usuarioRepository = new UsuarioRepository();
        this.jwtSecret = System.getenv("JWT_SECRET");
    }

    public String login(String username, String password) {
        Usuario usuario = usuarioRepository.findByUsername(username);
        if (usuario == null || !BCrypt.checkpw(password, usuario.getPassword())) {
            return null;
        }
        return generarToken(usuario);
    }

    private String generarToken(Usuario usuario) {
        return JWT.create()
            .withSubject(usuario.getUsername())
            .withClaim("rol", usuario.getRol())
            .withIssuedAt(new Date())
            .withExpiresAt(new Date(System.currentTimeMillis() + EXPIRACION_MS))
            .sign(Algorithm.HMAC256(jwtSecret));
    }

    public String hashPassword(String password) {
        return BCrypt.hashpw(password, BCrypt.gensalt());
    }
}
