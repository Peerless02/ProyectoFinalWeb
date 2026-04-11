package org.csti5488.cliente.ui;

import javafx.beans.property.SimpleStringProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.concurrent.Task;
import javafx.geometry.Insets;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import org.CSTI5488.edu.grpc.FormularioRequest;
import org.CSTI5488.edu.grpc.ListaFormulariosResponse;
import org.csti5488.cliente.service.GrpcClientService;
import org.csti5488.cliente.ui.model.FormularioRow;

public class ListarFormulariosTab {

    private final TextField  usernameField = new TextField();
    private final Button     buscarBtn     = new Button("Buscar");
    private final Label      statusLabel   = new Label();
    private final TableView<FormularioRow> table = new TableView<>();
    private final ObservableList<FormularioRow> data = FXCollections.observableArrayList();

    private final VBox root;

    public ListarFormulariosTab() {
        buscarBtn.setOnAction(e -> handleBuscar());
        buscarBtn.getStyleClass().add("primary-button");
        usernameField.setPromptText("Nombre de usuario");
        usernameField.setOnAction(e -> handleBuscar());
        buildTable();
        root = buildLayout();
    }

    public VBox getRoot() { return root; }

    private void buildTable() {
        TableColumn<FormularioRow, String> colNombre   = col("Nombre",           r -> r.getNombre(),          200);
        TableColumn<FormularioRow, String> colSector   = col("Sector",           r -> r.getSector(),          130);
        TableColumn<FormularioRow, String> colNivel    = col("Nivel Escolar",    r -> r.getNivelEscolar(),    160);
        TableColumn<FormularioRow, String> colUsuario  = col("Usuario Registro", r -> r.getUsuarioRegistro(), 140);
        TableColumn<FormularioRow, String> colLat      = col("Latitud",          r -> r.getLatitud(),          90);
        TableColumn<FormularioRow, String> colLng      = col("Longitud",         r -> r.getLongitud(),          90);
        TableColumn<FormularioRow, String> colFoto     = col("Foto",             r -> r.getTienesFoto(),        60);

        table.getColumns().addAll(colNombre, colSector, colNivel, colUsuario, colLat, colLng, colFoto);
        table.setItems(data);
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY_FLEX_LAST_COLUMN);
        table.setPlaceholder(new Label("Ingrese un usuario y presione Buscar"));
    }

    @FunctionalInterface
    private interface RowGetter { String get(FormularioRow r); }

    private TableColumn<FormularioRow, String> col(String title, RowGetter getter, double width) {
        TableColumn<FormularioRow, String> c = new TableColumn<>(title);
        c.setCellValueFactory(cell -> new SimpleStringProperty(getter.get(cell.getValue())));
        c.setPrefWidth(width);
        return c;
    }

    private VBox buildLayout() {
        Label userLbl = new Label("Usuario:");
        usernameField.setPrefWidth(220);

        HBox searchBar = new HBox(10, userLbl, usernameField, buscarBtn, statusLabel);
        searchBar.setPadding(new Insets(15, 15, 10, 15));
        searchBar.setAlignment(javafx.geometry.Pos.CENTER_LEFT);

        VBox layout = new VBox(searchBar, table);
        VBox.setVgrow(table, Priority.ALWAYS);
        return layout;
    }

    private void handleBuscar() {
        String username = usernameField.getText().trim();
        if (username.isBlank()) {
            statusLabel.setText("Ingrese un nombre de usuario.");
            statusLabel.setTextFill(Color.ORANGE);
            return;
        }

        buscarBtn.setDisable(true);
        statusLabel.setText("Buscando...");
        statusLabel.setTextFill(Color.GRAY);
        data.clear();

        Task<ListaFormulariosResponse> task = new Task<>() {
            @Override
            protected ListaFormulariosResponse call() {
                return GrpcClientService.getInstance().listarFormularios(username);
            }
        };

        task.setOnSucceeded(e -> {
            ListaFormulariosResponse resp = task.getValue();
            for (FormularioRequest f : resp.getFormulariosList()) {
                data.add(new FormularioRow(f));
            }
            int count = data.size();
            statusLabel.setText(count + " formulario(s) encontrado(s).");
            statusLabel.setTextFill(count > 0 ? Color.GREEN : Color.GRAY);
            buscarBtn.setDisable(false);
        });

        task.setOnFailed(e -> {
            Throwable ex = task.getException();
            statusLabel.setText("Error: " + (ex != null ? ex.getMessage() : "desconocido"));
            statusLabel.setTextFill(Color.RED);
            buscarBtn.setDisable(false);
        });

        Thread t = new Thread(task);
        t.setDaemon(true);
        t.start();
    }
}
