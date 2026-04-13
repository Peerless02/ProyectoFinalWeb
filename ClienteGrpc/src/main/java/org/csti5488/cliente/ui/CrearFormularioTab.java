package org.csti5488.cliente.ui;

import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.control.*;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.stage.FileChooser;
import org.CSTI5488.edu.grpc.FormularioResponse;
import org.csti5488.cliente.service.GrpcClientService;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Files;
import java.util.Base64;

public class CrearFormularioTab {

    private final TextField         nombreField   = new TextField();
    private final TextField         sectorField   = new TextField();
    private final ComboBox<String>  nivelBox      = new ComboBox<>();
    private final TextField         usuarioField  = new TextField();
    private final TextField         latitudField  = new TextField("0.0");
    private final TextField         longitudField = new TextField("0.0");

    private final Button    fotoBtn        = new Button("Seleccionar Foto...");
    private final ImageView fotoPreview    = new ImageView();
    private final Label     fotoNombreLabel = new Label("Sin foto seleccionada");
    private String          fotoBase64     = "";

    private final Button enviarBtn   = new Button("Enviar Formulario");
    private final Label  resultLabel = new Label();

    private final VBox root;

    public CrearFormularioTab() {
        nivelBox.getItems().addAll(
                "BASICO", "MEDIO", "GRADO_UNIVERSITARIO", "POSTGRADO", "DOCTORADO"
        );
        nivelBox.getSelectionModel().selectFirst();
        nivelBox.setMaxWidth(Double.MAX_VALUE);

        fotoPreview.setFitWidth(180);
        fotoPreview.setFitHeight(140);
        fotoPreview.setPreserveRatio(true);

        fotoBtn.setOnAction(e -> handleFotoChooser());
        enviarBtn.setOnAction(e -> handleEnviar());
        enviarBtn.getStyleClass().add("primary-button");
        resultLabel.setWrapText(true);

        root = buildLayout();
    }

    public VBox getRoot() { return root; }

    private VBox buildLayout() {
        GridPane form = new GridPane();
        form.setHgap(12);
        form.setVgap(12);
        form.setPadding(new Insets(24, 24, 12, 24));

        ColumnConstraints col0 = new ColumnConstraints(155);
        col0.setHalignment(javafx.geometry.HPos.RIGHT);
        ColumnConstraints col1 = new ColumnConstraints();
        col1.setHgrow(Priority.ALWAYS);
        form.getColumnConstraints().addAll(col0, col1);

        int row = 0;
        addRow(form, row++, "Nombre *:",        nombreField);
        addRow(form, row++, "Sector *:",         sectorField);
        addRow(form, row++, "Nivel Escolar *:",  nivelBox);
        addRow(form, row++, "Usuario Registro:", usuarioField);
        addRow(form, row++, "Latitud:",          latitudField);
        addRow(form, row++, "Longitud:",         longitudField);

        Label fotoLbl = new Label("Foto:");
        VBox fotoBox = new VBox(6, fotoBtn, fotoNombreLabel, fotoPreview);
        form.add(fotoLbl, 0, row);
        form.add(fotoBox, 1, row++);
        GridPane.setValignment(fotoLbl, javafx.geometry.VPos.TOP);

        VBox actionBox = new VBox(10, enviarBtn, resultLabel);
        actionBox.setPadding(new Insets(4, 24, 20, 24));

        ScrollPane scroll = new ScrollPane(form);
        scroll.setFitToWidth(true);
        scroll.setStyle("-fx-background-color: transparent; -fx-background: transparent;");

        VBox layout = new VBox(scroll, actionBox);
        VBox.setVgrow(scroll, Priority.ALWAYS);
        return layout;
    }

    private void addRow(GridPane grid, int row, String text, Control field) {
        Label lbl = new Label(text);
        lbl.setAlignment(Pos.CENTER_RIGHT);
        grid.add(lbl, 0, row);
        grid.add(field, 1, row);
        if (field instanceof TextField tf) {
            tf.setMaxWidth(Double.MAX_VALUE);
        }
    }

    private void handleFotoChooser() {
        FileChooser chooser = new FileChooser();
        chooser.setTitle("Seleccionar imagen");
        chooser.getExtensionFilters().addAll(
                new FileChooser.ExtensionFilter("Imágenes", "*.png", "*.jpg", "*.jpeg", "*.gif"),
                new FileChooser.ExtensionFilter("Todos los archivos", "*.*")
        );
        File file = chooser.showOpenDialog(fotoBtn.getScene().getWindow());
        if (file == null) return;

        try {
            byte[] bytes = Files.readAllBytes(file.toPath());
            fotoBase64 = Base64.getEncoder().encodeToString(bytes);
            fotoNombreLabel.setText(file.getName() + " (" + bytes.length / 1024 + " KB)");
            fotoPreview.setImage(new Image(new ByteArrayInputStream(bytes)));
        } catch (Exception ex) {
            fotoNombreLabel.setText("Error al leer la imagen: " + ex.getMessage());
        }
    }

    private void handleEnviar() {
        if (nombreField.getText().isBlank() || sectorField.getText().isBlank()) {
            showResult(false, "Nombre y sector son obligatorios.");
            return;
        }

        double latitud, longitud;
        try {
            latitud  = Double.parseDouble(latitudField.getText().trim());
            longitud = Double.parseDouble(longitudField.getText().trim());
        } catch (NumberFormatException ex) {
            showResult(false, "Latitud y longitud deben ser números decimales.");
            return;
        }

        String nombre   = nombreField.getText().trim();
        String sector   = sectorField.getText().trim();
        String nivel    = nivelBox.getValue();
        String usuario  = usuarioField.getText().trim();
        String foto     = fotoBase64;
        double lat      = latitud;
        double lng      = longitud;

        enviarBtn.setDisable(true);
        resultLabel.setText("Enviando...");
        resultLabel.setTextFill(Color.GRAY);

        Task<FormularioResponse> task = new Task<>() {
            @Override
            protected FormularioResponse call() {
                return GrpcClientService.getInstance()
                        .crearFormulario(nombre, sector, nivel, usuario, lat, lng, foto);
            }
        };

        task.setOnSucceeded(e -> {
            FormularioResponse resp = task.getValue();
            showResult(resp.getExito(), resp.getMensaje());
            enviarBtn.setDisable(false);
            if (resp.getExito()) clearForm();
        });

        task.setOnFailed(e -> {
            Throwable ex = task.getException();
            showResult(false, "Error de conexión: " + (ex != null ? ex.getMessage() : "desconocido"));
            enviarBtn.setDisable(false);
        });

        Thread t = new Thread(task);
        t.setDaemon(true);
        t.start();
    }

    private void showResult(boolean success, String message) {
        resultLabel.setText(message);
        resultLabel.setTextFill(success ? Color.GREEN : Color.RED);
    }

    private void clearForm() {
        nombreField.clear();
        sectorField.clear();
        nivelBox.getSelectionModel().selectFirst();
        usuarioField.clear();
        latitudField.setText("0.0");
        longitudField.setText("0.0");
        fotoBase64 = "";
        fotoNombreLabel.setText("Sin foto seleccionada");
        fotoPreview.setImage(null);
    }
}
