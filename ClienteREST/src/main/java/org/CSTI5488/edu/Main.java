package org.CSTI5488.edu;
import io.javalin.Javalin;

//TIP To <b>Run</b> code, press <shortcut actionId="Run"/> or
// click the <icon src="AllIcons.Actions.Execute"/> icon in the gutter.
public class Main {
    static void main() {//TIP Press <shortcut actionId="ShowIntentionActions"/> with your caret at the highlighted text
        // to see how IntelliJ IDEA suggests fixing it.
        var app = Javalin.create(config -> {
            config.routes.get("/", ctx -> ctx.result("Hello World"));
        }).start(7070);
    }
}
