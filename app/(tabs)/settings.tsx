import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { getDB } from "../../database/db";

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";

export default function SettingsScreen() {
  const [includeTransactions, setIncludeTransactions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // State untuk Data Master & Settings
  const [lowStockLimit, setLowStockLimit] = useState("5");
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );
  const [units, setUnits] = useState<{ id: number; name: string }[]>([]);

  // State untuk Modal List Master Data
  const [masterModalVisible, setMasterModalVisible] = useState(false);
  const [masterModalType, setMasterModalType] = useState<"category" | "unit">(
    "category",
  );

  // State untuk Overlay Edit Kategori/Satuan
  const [editOverlayVisible, setEditOverlayVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editOldName, setEditOldName] = useState("");
  const [editNewName, setEditNewName] = useState("");

  // State untuk About Modal
  const [aboutModalVisible, setAboutModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
    }, []),
  );

  const fetchSettings = async () => {
    try {
      const db = await getDB();
      const limitObj = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = "low_stock_threshold"',
      );
      if (limitObj) setLowStockLimit(limitObj.value);

      const cats = await db.getAllAsync<{ id: number; name: string }>(
        "SELECT * FROM categories ORDER BY name ASC",
      );
      setCategories(cats);

      const unts = await db.getAllAsync<{ id: number; name: string }>(
        "SELECT * FROM units ORDER BY name ASC",
      );
      setUnits(unts);
    } catch (error) {
      console.error("Gagal load settings", error);
    }
  };

  // ==============================
  // SETTINGS & MASTER DATA
  // ==============================
  const handleSaveThreshold = async () => {
    if (!lowStockLimit || isNaN(Number(lowStockLimit))) {
      Alert.alert("Error", "Batas stok harus berupa angka valid");
      return;
    }
    try {
      const db = await getDB();
      await db.runAsync(
        'UPDATE app_settings SET value = ? WHERE key = "low_stock_threshold"',
        [lowStockLimit],
      );
      Alert.alert("Sukses", "Batas indikator stok menipis berhasil disimpan!");
    } catch (error) {
      Alert.alert("Error", "Gagal menyimpan pengaturan");
    }
  };

  const openMasterModal = (type: "category" | "unit") => {
    setMasterModalType(type);
    setMasterModalVisible(true);
  };

  const openEditMaster = (id: number, name: string) => {
    setEditId(id);
    setEditOldName(name);
    setEditNewName(name);
    setEditOverlayVisible(true);
  };

  const handleSaveEditMaster = async () => {
    if (!editNewName.trim()) {
      Alert.alert("Error", "Nama tidak boleh kosong");
      return;
    }
    try {
      const db = await getDB();
      if (masterModalType === "category") {
        await db.runAsync("UPDATE categories SET name = ? WHERE id = ?", [
          editNewName,
          editId,
        ]);
        await db.runAsync("UPDATE items SET category = ? WHERE category = ?", [
          editNewName,
          editOldName,
        ]);
      } else {
        await db.runAsync("UPDATE units SET name = ? WHERE id = ?", [
          editNewName,
          editId,
        ]);
        await db.runAsync("UPDATE items SET unit = ? WHERE unit = ?", [
          editNewName,
          editOldName,
        ]);
      }
      setEditOverlayVisible(false);
      fetchSettings();
    } catch (error) {
      Alert.alert("Error", "Nama mungkin sudah ada atau terjadi kesalahan");
    }
  };

  const handleDeleteMaster = (id: number, name: string) => {
    Alert.alert(
      "Hapus Data",
      `Yakin menghapus ${name}? Barang yang menggunakan ${masterModalType === "category" ? "kategori" : "satuan"} ini akan diubah menjadi "Umum".`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDB();
              if (masterModalType === "category") {
                await db.runAsync("DELETE FROM categories WHERE id = ?", [id]);
                await db.runAsync(
                  'UPDATE items SET category = "Umum" WHERE category = ?',
                  [name],
                );
              } else {
                await db.runAsync("DELETE FROM units WHERE id = ?", [id]);
                await db.runAsync(
                  'UPDATE items SET unit = "Umum" WHERE unit = ?',
                  [name],
                );
              }
              fetchSettings();
            } catch (error) {
              Alert.alert("Error", "Gagal menghapus data");
            }
          },
        },
      ],
    );
  };

  // ==============================
  // EXPORT / IMPORT
  // ==============================
  const handleExport = async () => {
    setIsLoading(true);
    try {
      const db = await getDB();
      const items = await db.getAllAsync("SELECT * FROM items ORDER BY id ASC");
      const wb = XLSX.utils.book_new();

      const itemsForExcel = items.map((i: any) => ({
        ID_Barang: i.id,
        Nama_Barang: i.name,
        Kategori: i.category,
        Stok: i.stock,
        Satuan: i.unit,
        Harga_Modal: i.cost_price || 0,
        Harga_Jual: i.sell_price || i.price || 0,
        Deskripsi: i.description || "",
      }));
      const wsItems = XLSX.utils.json_to_sheet(itemsForExcel);
      XLSX.utils.book_append_sheet(wb, wsItems, "Master Barang");

      if (includeTransactions) {
        const transactions = await db.getAllAsync(`
          SELECT t.id, i.name as item_name, t.type, t.quantity, t.date, t.notes 
          FROM transactions t JOIN items i ON t.item_id = i.id ORDER BY t.date ASC
        `);
        const transForExcel = transactions.map((t: any) => ({
          ID_Transaksi: t.id,
          Tanggal: new Date(t.date).toLocaleString("id-ID"),
          Nama_Barang: t.item_name,
          Jenis_Mutasi: t.type === "IN" ? "MASUK" : "KELUAR",
          Jumlah: t.quantity,
          Catatan: t.notes || "",
        }));
        const wsTrans = XLSX.utils.json_to_sheet(transForExcel);
        XLSX.utils.book_append_sheet(wb, wsTrans, "Riwayat Mutasi");
      }

      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const fileName = `KopiKocok_Backup_${new Date().getTime()}.xlsx`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: "base64",
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable)
        await Sharing.shareAsync(fileUri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Simpan Excel",
        });
    } catch (error) {
      Alert.alert("Error", "Gagal mengekspor data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setIsLoading(true);
      const fileUri = result.assets[0].uri;
      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: "base64",
      });
      const wb = XLSX.read(fileBase64, { type: "base64" });
      const wsname = wb.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

      if (data.length === 0) {
        Alert.alert("Error", "Excel kosong atau format salah.");
        setIsLoading(false);
        return;
      }
      Alert.alert("Konfirmasi", `Import ${data.length} baris data?`, [
        { text: "Batal", style: "cancel", onPress: () => setIsLoading(false) },
        { text: "Import", onPress: async () => await processImportData(data) },
      ]);
    } catch (error) {
      Alert.alert("Error", "Gagal membaca Excel.");
      setIsLoading(false);
    }
  };

  const processImportData = async (jsonData: any[]) => {
    try {
      const db = await getDB();
      let successCount = 0;
      for (let row of jsonData) {
        const name = row["Nama_Barang"] || row["name"] || row["Nama"];
        const category = row["Kategori"] || row["category"] || "Umum";
        const stock = parseFloat(row["Stok"] || row["stock"]) || 0;
        const unit = row["Satuan"] || row["unit"] || "Pcs";
        const costPrice =
          parseFloat(row["Harga_Modal"] || row["cost_price"]) || 0;
        const sellPrice =
          parseFloat(row["Harga_Jual"] || row["sell_price"]) || 0;
        const desc = row["Deskripsi"] || row["description"] || "";

        if (name) {
          await db.runAsync(
            `INSERT INTO items (name, category, stock, unit, cost_price, sell_price, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, category, stock, unit, costPrice, sellPrice, desc],
          );
          await db.runAsync(
            "INSERT OR IGNORE INTO categories (name) VALUES (?)",
            [category],
          );
          await db.runAsync("INSERT OR IGNORE INTO units (name) VALUES (?)", [
            unit,
          ]);
          successCount++;
        }
      }
      Alert.alert("Berhasil", `${successCount} data diimpor!`);
      fetchSettings();
    } catch (error) {
      Alert.alert("Error", "Gagal memproses data.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetMutasi = () => {
    Alert.alert(
      "⚠️ Peringatan",
      "Semua riwayat mutasi akan dihapus permanen. Lanjutkan?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Hapus Mutasi",
          style: "destructive",
          onPress: async () => {
            const db = await getDB();
            await db.runAsync("DELETE FROM transactions");
            Alert.alert("Selesai", "Data mutasi dikosongkan.");
          },
        },
      ],
    );
  };

  const resetSemuaData = () => {
    Alert.alert(
      "💥 HAPUS SEMUA",
      "Akan menghapus SEMUA BARANG dan MUTASI. Lanjutkan?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Semuanya",
          style: "destructive",
          onPress: async () => {
            const db = await getDB();
            await db.runAsync("DELETE FROM transactions");
            await db.runAsync("DELETE FROM items");
            Alert.alert("Selesai", "Aplikasi di-reset.");
          },
        },
      ],
    );
  };

  // Fungsi untuk membuka link
  const openLink = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", `Tidak bisa membuka link: ${url}`);
    }
  };

  const categoriesList = ["Susu", "Biji Kopi", "Sirup", "Bahan Dasar", "Kemasan", "Tambahan"];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Pengaturan</Text>
          <Text style={styles.subtitle}>Kelola preferensi aplikasi Kopi Kocok</Text>
        </View>

        {/* Bento Grid */}
        <View style={styles.bentoGrid}>
          
          {/* Notifikasi Card */}
          <View style={[styles.bentoCard, styles.bentoFull]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: '#FFF8E1' }]}>
                <Ionicons name="notifications-outline" size={20} color="#F57F17" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Notifikasi Stok Menipis</Text>
                <Text style={styles.cardSubtitle}>Ambang batas peringatan</Text>
              </View>
            </View>
            <View style={styles.thresholdContainer}>
              <View style={styles.thresholdValue}>
                <Text style={styles.thresholdText}>{lowStockLimit}</Text>
              </View>
              <TextInput
                style={styles.thresholdInput}
                keyboardType="numeric"
                value={lowStockLimit}
                onChangeText={setLowStockLimit}
                placeholder="5"
                placeholderTextColor="#B0A090"
              />
              <TouchableOpacity style={styles.thresholdButton} onPress={handleSaveThreshold}>
                <Text style={styles.thresholdButtonText}>Simpan</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>
              Barang dengan stok di bawah angka ini akan muncul di indikator Dashboard.
            </Text>
          </View>

          {/* Master Data Card */}
          <View style={[styles.bentoCard, styles.bentoFull]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="folder-outline" size={20} color="#2E7D32" />
              </View>
              <View>
                <Text style={styles.cardTitle}>Kelola Master Data</Text>
                <Text style={styles.cardSubtitle}>Kategori & Satuan barang</Text>
              </View>
            </View>
            
            <View style={styles.masterTags}>
              {categoriesList.map((cat, idx) => {
                const colors = ['#D4A373', '#7BA3C8', '#E8897A', '#A8C5A0', '#B8A4D4', '#F4C87A'];
                return (
                  <Text key={idx} style={[styles.masterTag, { backgroundColor: `${colors[idx % colors.length]}22`, color: colors[idx % colors.length] }]}>
                    {cat}
                  </Text>
                );
              })}
            </View>

            <View style={styles.masterButtons}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => openMasterModal("category")}>
                <Ionicons name="list-outline" size={18} color="#D4A373" />
                <Text style={styles.outlineBtnText}>Kelola Kategori</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => openMasterModal("unit")}>
                <Ionicons name="scale-outline" size={18} color="#D4A373" />
                <Text style={styles.outlineBtnText}>Kelola Satuan</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Backup Card */}
          <View style={styles.bentoCard}>
            <View style={styles.squareCardContent}>
              <View style={styles.documentIcon}>
                <View style={styles.documentIconBack} />
                <View style={styles.documentIconFront}>
                  <Ionicons name="document-text-outline" size={24} color="#2E7D32" />
                </View>
              </View>
              <Text style={styles.squareCardTitle}>Backup Data</Text>
              <Text style={styles.squareCardSubtitle}>Export/Import Excel</Text>
              <TouchableOpacity style={styles.backupBtn} onPress={handleExport} disabled={isLoading}>
                <Ionicons name="download-outline" size={14} color="#FDF8F5" />
                <Text style={styles.backupBtnText}>Export</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.restoreBtn} onPress={handleImport} disabled={isLoading}>
                <Ionicons name="cloud-upload-outline" size={14} color="#5C2C06" />
                <Text style={styles.restoreBtnText}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Danger Zone Card */}
          <View style={[styles.bentoCard, styles.dangerCard]}>
            <View style={styles.squareCardContent}>
              <View style={[styles.dangerIconWrapper, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="warning-outline" size={24} color="#C62828" />
              </View>
              <Text style={styles.dangerTitle}>Zona Berbahaya</Text>
              <Text style={styles.dangerSubtitle}>Hapus semua data dan reset ke awal</Text>
              <TouchableOpacity style={styles.dangerResetBtn} onPress={resetSemuaData}>
                <Ionicons name="refresh-outline" size={14} color="#FFFFFF" />
                <Text style={styles.dangerResetBtnText}>Factory Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dangerMutasiBtn} onPress={resetMutasi}>
                <Ionicons name="trash-outline" size={14} color="#C62828" />
                <Text style={styles.dangerMutasiBtnText}>Reset Mutasi Saja</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* About Card - Full Width */}
          <TouchableOpacity 
            style={[styles.bentoCard, styles.bentoFull, styles.aboutCard]}
            onPress={() => setAboutModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconWrapper, { backgroundColor: '#E3F0FF' }]}>
                <Ionicons name="information-circle-outline" size={20} color="#4A90D9" />
              </View>
              <View style={styles.aboutContent}>
                <Text style={styles.cardTitle}>Tentang Aplikasi</Text>
                <Text style={styles.cardSubtitle}>Informasi versi & pengembang</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#8C7B6E" />
            </View>
          </TouchableOpacity>

          {/* App Info Card */}
          <View style={[styles.bentoCard, styles.appInfoCard, styles.bentoFull]}>
            <View style={styles.appInfoContent}>
              <View>
                <Text style={styles.appInfoTitle}>☕ Kopi Kocok</Text>
                <Text style={styles.appInfoVersion}>Versi 1.0.0</Text>
              </View>
              <View style={styles.proPlanBadge}>
                <Text style={styles.proPlanText}>Aplikasi KP</Text>
              </View>
            </View>
          </View>

        </View>

        {/* Extra bottom padding agar tidak tertutup navbar */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* MODAL ABOUT */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={aboutModalVisible}
        onRequestClose={() => setAboutModalVisible(false)}
      >
        <View style={styles.aboutModalOverlay}>
          <View style={styles.aboutModalContent}>
            <View style={styles.aboutModalHeader}>
              <Text style={styles.aboutModalTitle}>Tentang Aplikasi</Text>
              <TouchableOpacity onPress={() => setAboutModalVisible(false)}>
                <Ionicons name="close" size={24} color="#5C2C06" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.aboutModalBody} showsVerticalScrollIndicator={false}>
              {/* Logo / Icon */}
              <View style={styles.aboutLogoContainer}>
                <View style={styles.aboutLogo}>
                  <Ionicons name="cafe" size={48} color="#D4A373" />
                </View>
                <Text style={styles.aboutAppName}>Kopi Kocok</Text>
                <Text style={styles.aboutAppVersion}>Stock Management System v1.0.0</Text>
              </View>

              {/* Deskripsi */}
              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>Deskripsi</Text>
                <Text style={styles.aboutText}>
                  Aplikasi ini dikembangkan sebagai bagian dari Tugas Kerja Praktik 
                  untuk memenuhi persyaratan kelulusan. Aplikasi ini bertujuan untuk membantu 
                  manajemen stok dan mutasi barang pada usaha Kopi Kocok Sukabumi .
                </Text>
              </View>

              {/* Pengembang */}
              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>Pengembang</Text>
                <View style={styles.aboutDeveloperItem}>
                  <Ionicons name="person-outline" size={18} color="#5C2C06" />
                  <View>
                    <Text style={styles.aboutDeveloperName}>LiefHax</Text>
                  </View>
                </View>
              </View>

              {/* Link */}
              <View style={styles.aboutSection}>
                <Text style={styles.aboutSectionTitle}>🔗 Link Terkait</Text>
                
                <TouchableOpacity 
                  style={styles.aboutLinkItem} 
                  onPress={() => openLink('https://github.com/liefhax')}
                >
                  <Ionicons name="logo-github" size={20} color="#333" />
                  <Text style={styles.aboutLinkText}>GitHub Repository</Text>
                  <Ionicons name="open-outline" size={16} color="#8C7B6E" style={styles.aboutLinkIcon} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.aboutLinkItem} 
                  onPress={() => openLink('https://github.com/liefhax/kopikocok/issues')}
                >
                  <Ionicons name="bug-outline" size={20} color="#E53935" />
                  <Text style={styles.aboutLinkText}>Laporkan Bug</Text>
                  <Ionicons name="open-outline" size={16} color="#8C7B6E" style={styles.aboutLinkIcon} />
                </TouchableOpacity>
              </View>

              {/* Credit & Footer */}
              <View style={styles.aboutFooter}>
                <Text style={styles.aboutFooterText}>
                  Dibuat untuk memenuhi Kerja Praktik
                </Text>
                <Text style={styles.aboutFooterText}>
                  © 2026 Kopi Kocok - All Rights Reserved
                </Text>
                <Text style={styles.aboutFooterText}>
                  Made with Coffee and Insomnia
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.aboutModalCloseBtn} 
              onPress={() => setAboutModalVisible(false)}
            >
              <Text style={styles.aboutModalCloseText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL LIST MASTER DATA */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={masterModalVisible}
        onRequestClose={() => setMasterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Daftar {masterModalType === "category" ? "Kategori" : "Satuan"}
              </Text>
              <TouchableOpacity onPress={() => setMasterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#5C2C06" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={masterModalType === "category" ? categories : units}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({ item }) => (
                <View style={styles.masterItem}>
                  <Text style={styles.masterItemText}>{item.name}</Text>
                  <View style={{ flexDirection: "row" }}>
                    <TouchableOpacity
                      style={styles.masterIconBtn}
                      onPress={() => openEditMaster(item.id, item.name)}
                    >
                      <Ionicons name="create-outline" size={20} color="#4A90D9" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.masterIconBtn}
                      onPress={() => handleDeleteMaster(item.id, item.name)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#E53935" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: "center", color: "#B0A090", marginTop: 20, fontFamily: 'Inter' }}>
                  Belum ada data
                </Text>
              }
            />

            {editOverlayVisible && (
              <View style={styles.overlayAbsolute}>
                <View style={styles.overlayContent}>
                  <Text style={styles.modalTitle}>Edit Nama</Text>
                  <TextInput
                    style={styles.overlayInput}
                    value={editNewName}
                    onChangeText={setEditNewName}
                    autoFocus
                    placeholderTextColor="#B0A090"
                  />
                  <View style={styles.overlayButtons}>
                    <TouchableOpacity onPress={() => setEditOverlayVisible(false)}>
                      <Text style={styles.overlayCancelText}>Batal</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.overlaySaveBtn} onPress={handleSaveEditMaster}>
                      <Text style={styles.overlaySaveText}>Simpan</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* LOADING OVERLAY */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#D4A373" />
          <Text style={{ marginTop: 12, color: '#5C2C06', fontFamily: 'Outfit', fontWeight: '600' }}>
            Memproses...
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#FAF7F2' 
  },
  scrollContainer: { 
    paddingBottom: 40 
  },
  header: { 
    padding: 20, 
    paddingBottom: 8 
  },
  title: { 
    fontSize: 22, 
    fontWeight: '800', 
    fontFamily: 'Outfit', 
    color: '#5C2C06' 
  },
  subtitle: { 
    fontSize: 13, 
    fontFamily: 'Inter', 
    color: '#8C7B6E', 
    marginTop: 4 
  },

  // Bottom padding agar tidak tertutup navbar
  bottomPadding: {
    height: 100,
  },

  // Bento Grid
  bentoGrid: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  bentoCard: {
    backgroundColor: '#FDF8F5',
    borderRadius: 20,
    padding: 18,
    width: '48%',
    shadowColor: '#A07850',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  bentoFull: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Outfit',
    color: '#2C1A0E',
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter',
    color: '#8C7B6E',
    marginTop: 2,
  },
  hintText: {
    fontSize: 10,
    fontFamily: 'Inter',
    color: '#B0A090',
    marginTop: 10,
    fontStyle: 'italic',
  },

  // Threshold
  thresholdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  thresholdValue: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#5C2C06',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thresholdText: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Outfit',
    color: '#FDF8F5',
  },
  thresholdInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EDE8E2',
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    fontFamily: 'Inter',
    color: '#2C1A0E',
  },
  thresholdButton: {
    backgroundColor: '#D4A373',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  thresholdButtonText: {
    color: '#FDF8F5',
    fontWeight: '600',
    fontFamily: 'Outfit',
    fontSize: 12,
  },

  // Master Tags
  masterTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  masterTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: '600',
    overflow: 'hidden',
  },
  masterButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4A373',
    gap: 6,
  },
  outlineBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit',
    fontWeight: '600',
    color: '#D4A373',
  },

  // Square Card
  squareCardContent: {
    alignItems: 'center',
    gap: 8,
  },
  documentIcon: {
    width: 56,
    height: 60,
    position: 'relative',
    marginBottom: 4,
  },
  documentIconBack: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: 46,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#C8E6C9',
  },
  documentIconFront: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 46,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Outfit',
    color: '#2C1A0E',
  },
  squareCardSubtitle: {
    fontSize: 10,
    fontFamily: 'Inter',
    color: '#8C7B6E',
  },
  backupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5C2C06',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
    width: '100%',
    marginTop: 4,
  },
  backupBtnText: {
    color: '#FDF8F5',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit',
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE8E2',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
    width: '100%',
  },
  restoreBtnText: {
    color: '#5C2C06',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit',
  },

  // Danger Zone
  dangerCard: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: 'rgba(229,57,53,0.15)',
  },
  dangerIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Outfit',
    color: '#C62828',
  },
  dangerSubtitle: {
    fontSize: 10,
    fontFamily: 'Inter',
    color: '#8C7B6E',
    textAlign: 'center',
    marginBottom: 8,
  },
  dangerResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C62828',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    width: '100%',
  },
  dangerResetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit',
  },
  dangerMutasiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#C62828',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    width: '100%',
    marginTop: 8,
  },
  dangerMutasiBtnText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit',
  },

  // About Card
  aboutCard: {
    backgroundColor: '#FDF8F5',
  },
  aboutContent: {
    flex: 1,
  },

  // App Info
  appInfoCard: {
    backgroundColor: '#4A2A18',
  },
  appInfoContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appInfoTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'Outfit',
    color: '#FDF8F5',
  },
  appInfoVersion: {
    fontSize: 10,
    fontFamily: 'Inter',
    color: 'rgba(212,163,115,0.8)',
    marginTop: 2,
  },
  proPlanBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(212,163,115,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(212,163,115,0.3)',
  },
  proPlanText: {
    fontSize: 10,
    fontFamily: 'Inter',
    fontWeight: '600',
    color: '#D4A373',
  },

  // ABOUT MODAL
  aboutModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(45,25,10,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  aboutModalContent: {
    backgroundColor: '#FDF8F5',
    width: '90%',
    maxHeight: '85%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  aboutModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92,44,6,0.08)',
  },
  aboutModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Outfit',
    color: '#5C2C06',
  },
  aboutModalBody: {
    padding: 20,
  },
  aboutLogoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  aboutLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EDE8E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  aboutAppName: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'Outfit',
    color: '#5C2C06',
  },
  aboutAppVersion: {
    fontSize: 12,
    fontFamily: 'Inter',
    color: '#8C7B6E',
    marginTop: 4,
  },
  aboutSection: {
    marginBottom: 20,
  },
  aboutSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Outfit',
    color: '#5C2C06',
    marginBottom: 10,
  },
  aboutText: {
    fontSize: 13,
    fontFamily: 'Inter',
    color: '#2C1A0E',
    lineHeight: 20,
    textAlign: 'justify',
  },
  aboutDeveloperItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92,44,6,0.06)',
  },
  aboutDeveloperName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#2C1A0E',
  },
  aboutDeveloperDetail: {
    fontSize: 12,
    fontFamily: 'Inter',
    color: '#8C7B6E',
    marginTop: 2,
  },
  aboutLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(92,44,6,0.06)',
    gap: 12,
  },
  aboutLinkText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter',
    color: '#2C1A0E',
  },
  aboutLinkIcon: {
    marginLeft: 'auto',
  },
  aboutFooter: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(92,44,6,0.08)',
    alignItems: 'center',
  },
  aboutFooterText: {
    fontSize: 11,
    fontFamily: 'Inter',
    color: '#B0A090',
    textAlign: 'center',
    marginBottom: 4,
  },
  aboutModalCloseBtn: {
    backgroundColor: '#EDE8E2',
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(92,44,6,0.08)',
  },
  aboutModalCloseText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#5C2C06',
  },

  // Modal Master Data
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(45,25,10,0.6)', 
    justifyContent: 'flex-end', 
    zIndex: 1 
  },
  modalContent: { 
    backgroundColor: '#FDF8F5', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    height: '80%' 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(92,44,6,0.08)' 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    fontFamily: 'Outfit', 
    color: '#5C2C06' 
  },
  masterItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(92,44,6,0.06)' 
  },
  masterItemText: { 
    fontSize: 15, 
    fontFamily: 'Inter', 
    color: '#2C1A0E' 
  },
  masterIconBtn: { 
    padding: 8, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    marginLeft: 8, 
    shadowColor: '#5C2C06', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 1 
  },

  // Overlay Edit
  overlayAbsolute: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(45,25,10,0.7)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 1000 
  },
  overlayContent: { 
    backgroundColor: '#FDF8F5', 
    width: '85%', 
    borderRadius: 20, 
    padding: 20 
  },
  overlayInput: { 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#EDE8E2', 
    borderRadius: 14, 
    padding: 14, 
    fontSize: 15, 
    fontFamily: 'Inter', 
    color: '#2C1A0E', 
    marginTop: 12, 
    marginBottom: 20 
  },
  overlayButtons: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 16 
  },
  overlayCancelText: { 
    color: '#8C7B6E', 
    fontWeight: '600', 
    fontFamily: 'Outfit', 
    fontSize: 14 
  },
  overlaySaveBtn: { 
    backgroundColor: '#D4A373', 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 12 
  },
  overlaySaveText: { 
    color: '#FDF8F5', 
    fontWeight: '600', 
    fontFamily: 'Outfit', 
    fontSize: 14 
  },

  // Loading
  loadingOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(250,247,242,0.9)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 1000 
  },
});