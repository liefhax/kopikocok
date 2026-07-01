import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDB } from "../../database/db";

interface Item {
  id: number;
  name: string;
  stock: number;
  unit: string;
}

interface Transaction {
  id: number;
  item_id: number;
  item_name: string;
  type: "IN" | "OUT";
  quantity: number;
  date: string;
  notes: string | null;
  unit: string;
}

export default function TransactionsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  // Filter & Sort State
  const [sortOrder, setSortOrder] = useState<"DESC" | "ASC">("DESC");
  const [activeFilter, setActiveFilter] = useState("Semua");
  const [selectedStartDate, setSelectedStartDate] = useState<string | null>(
    null,
  );
  const [selectedEndDate, setSelectedEndDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMode, setCalendarMode] = useState<"start" | "end">("start");
  const [markedDates, setMarkedDates] = useState<{ [key: string]: any }>({});

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);

  // Form State
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Custom Date/Time Form State - PENTING: Menyimpan tanggal dan jam terpisah
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [showTransactionCalendar, setShowTransactionCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Helper untuk mendapatkan waktu saat ini dengan zona lokal
  const getCurrentDateTime = () => {
    const now = new Date();
    return now;
  };

  // Helper untuk menggabungkan tanggal dan jam
  const getCombinedDateTime = () => {
    const combined = new Date(selectedDate);
    combined.setHours(selectedTime.getHours());
    combined.setMinutes(selectedTime.getMinutes());
    combined.setSeconds(0);
    return combined;
  };

  const filterOptions = [
    "Semua",
    "Hari Ini",
    "Minggu Ini",
    "Bulan Ini",
    "Range Tanggal",
  ];

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [sortOrder, activeFilter, selectedStartDate, selectedEndDate]),
  );

const fetchData = async () => {
  try {
    const db = await getDB();
    
    let query = `
      SELECT t.*, i.name as item_name, i.unit 
      FROM transactions t 
      JOIN items i ON t.item_id = i.id 
    `;
    
    let filterCondition = '';
    let params: any[] = [];
    
    if (activeFilter === 'Hari Ini') {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      filterCondition = `WHERE date(t.date) = ?`;
      params = [`${year}-${month}-${day}`];
    } 
    else if (activeFilter === 'Minggu Ini') {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
      const startStr = startOfWeek.toISOString().split('T')[0];
      const endStr = endOfWeek.toISOString().split('T')[0];
      filterCondition = `WHERE date(t.date) BETWEEN ? AND ?`;
      params = [startStr, endStr];
    } 
    else if (activeFilter === 'Bulan Ini') {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      filterCondition = `WHERE strftime('%Y-%m', t.date) = ?`;
      params = [`${year}-${month}`];
    } 
    else if (activeFilter === 'Range Tanggal' && selectedStartDate && selectedEndDate) {
      filterCondition = `WHERE date(t.date) BETWEEN ? AND ?`;
      params = [selectedStartDate, selectedEndDate];
    }
    
    const finalQuery = `${query} ${filterCondition} ORDER BY t.date ${sortOrder}`;
    const trxResult = await db.getAllAsync<Transaction>(finalQuery, params);
    setTransactions(trxResult);

    try {
      const itemResult = await db.getAllAsync<Item>('SELECT id, name, stock, unit FROM items ORDER BY name ASC');
      setItems(itemResult);
    } catch (itemError) {
      console.warn("Gagal mengambil items:", itemError);
      setItems([]);
    }
    
  } catch (error) {
    console.error("Gagal mengambil data transaksi:", error);
    // Set empty state agar tidak crash
    setTransactions([]);
    Alert.alert("Error", "Gagal memuat data transaksi. Silakan coba lagi.");
  }
};

  const resetForm = () => {
    setSelectedItem(null);
    setType("IN");
    setQuantity("");
    setNotes("");
    const now = getCurrentDateTime();
    setSelectedDate(now);
    setSelectedTime(now);
  };

  const handleOpenInputModal = async () => {
    resetForm();
    await fetchData();
    setModalVisible(true);
  };

  const handleOpenSelectModal = async () => {
    setSearchQuery("");
    await fetchData();
    setItemModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedItem || !quantity) {
      Alert.alert("Error", "Pilih barang dan masukkan jumlah!");
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Error", "Jumlah harus berupa angka lebih dari 0");
      return;
    }

    try {
      const db = await getDB();
      // Gunakan kombinasi tanggal dan jam yang dipilih user
      const dateTimeToSave = getCombinedDateTime();
      const dateToSave = dateTimeToSave.toISOString();
      const modifier = type === "IN" ? qty : -qty;

      if (type === "OUT" && selectedItem.stock < qty) {
        Alert.alert(
          "Gagal",
          `Stok tidak cukup! Stok saat ini: ${selectedItem.stock} ${selectedItem.unit}`,
        );
        return;
      }

      await db.runAsync(
        `INSERT INTO transactions (item_id, type, quantity, date, notes) VALUES (?, ?, ?, ?, ?)`,
        [selectedItem.id, type, qty, dateToSave, notes],
      );

      await db.runAsync(`UPDATE items SET stock = stock + ? WHERE id = ?`, [
        modifier,
        selectedItem.id,
      ]);

      setModalVisible(false);
      fetchData();
      resetForm();
    } catch (error) {
      Alert.alert("Error", "Gagal memproses mutasi.");
      console.error(error);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatShortDate = (date: Date) => {
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleFilterPress = (filter: string) => {
    setActiveFilter(filter);
    if (filter === "Range Tanggal") {
      setCalendarMode("start");
      setShowCalendar(true);
    } else {
      setSelectedStartDate(null);
      setSelectedEndDate(null);
      setMarkedDates({});
    }
  };

  const handleCalendarDayPress = (day: any) => {
    const dateString = day.dateString;

    if (calendarMode === "start") {
      setSelectedStartDate(dateString);
      setCalendarMode("end");
      setMarkedDates({
        [dateString]: {
          startingDay: true,
          color: "#5C2C06",
          textColor: "#FFFFFF",
        },
      });
    } else if (calendarMode === "end") {
      if (selectedStartDate && dateString >= selectedStartDate) {
        setSelectedEndDate(dateString);
        setShowCalendar(false);
        setCalendarMode("start");

        const range: { [key: string]: any } = {};
        const start = new Date(selectedStartDate);
        const end = new Date(dateString);
        let current = new Date(start);

        while (current <= end) {
          const dateKey = current.toISOString().split("T")[0];
          if (dateKey === selectedStartDate) {
            range[dateKey] = {
              startingDay: true,
              color: "#5C2C06",
              textColor: "#FFFFFF",
            };
          } else if (dateKey === dateString) {
            range[dateKey] = {
              endingDay: true,
              color: "#5C2C06",
              textColor: "#FFFFFF",
            };
          } else {
            range[dateKey] = { color: "#D4A373", textColor: "#FFFFFF" };
          }
          current.setDate(current.getDate() + 1);
        }
        setMarkedDates(range);
      } else {
        Alert.alert(
          "Invalid Range",
          "Tanggal selesai harus setelah tanggal mulai",
        );
      }
    }
  };

  const handleClearRange = () => {
    setSelectedStartDate(null);
    setSelectedEndDate(null);
    setMarkedDates({});
    setActiveFilter("Semua");
    setCalendarMode("start");
  };

  const handleTransactionDateSelect = (day: any) => {
    // Mempertahankan jam saat mengganti tanggal
    const newDate = new Date(day.dateString);
    newDate.setHours(selectedDate.getHours());
    newDate.setMinutes(selectedDate.getMinutes());
    setSelectedDate(newDate);
    setShowTransactionCalendar(false);
  };

  const handleTimeChange = (event: any, selectedTimeValue?: Date) => {
    setShowTimePicker(false);
    if (selectedTimeValue) {
      // Mempertahankan tanggal saat mengganti jam
      const newTime = new Date(selectedTimeValue);
      const updatedDate = new Date(selectedDate);
      updatedDate.setHours(newTime.getHours());
      updatedDate.setMinutes(newTime.getMinutes());
      setSelectedDate(updatedDate);
      setSelectedTime(updatedDate);
    }
  };

  const filteredItemsForSelect = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderTransaction = ({
    item,
    index,
  }: {
    item: Transaction;
    index: number;
  }) => {
    const isIN = item.type === "IN";
    const isLast = index === transactions.length - 1;

    return (
      <View style={styles.timelineItem}>
        <View
          style={[
            styles.timelineDot,
            { backgroundColor: isIN ? "#2E7D32" : "#C62828" },
          ]}
        />
        {!isLast && <View style={styles.timelineLine} />}

        <View style={[styles.card, isTablet && styles.cardTablet]}>
          <View style={styles.cardHeader}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.item_name}
            </Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: isIN ? "#E8F5E9" : "#FFEBEE" },
              ]}
            >
              <Ionicons
                name={isIN ? "arrow-down" : "arrow-up"}
                size={14}
                color={isIN ? "#2E7D32" : "#C62828"}
              />
              <Text
                style={[
                  styles.badgeText,
                  { color: isIN ? "#2E7D32" : "#C62828" },
                ]}
              >
                {isIN ? "MASUK" : "KELUAR"}
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <Text
              style={[styles.qtyText, { color: isIN ? "#2E7D32" : "#C62828" }]}
            >
              {isIN ? "+" : "-"}
              {item.quantity} {item.unit}
            </Text>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          </View>

          {item.notes && (
            <Text style={styles.noteText} numberOfLines={1}>
              <Ionicons name="chatbubble-outline" size={10} /> {item.notes}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Mutasi Stok</Text>
          <Text style={styles.subtitle}>Catat barang masuk & keluar</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleOpenInputModal}
        >
          <Ionicons name="add" size={24} color="#FDF8F5" />
          <Text style={styles.addButtonText}>Input</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Section */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>Filter:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsContainer}
        >
          {filterOptions.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                activeFilter === filter && styles.filterChipActive,
              ]}
              onPress={() => handleFilterPress(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {activeFilter === "Range Tanggal" &&
          selectedStartDate &&
          selectedEndDate && (
            <View style={styles.activeRangeContainer}>
              <Ionicons name="calendar" size={14} color="#5C2C06" />
              <Text style={styles.activeRangeText}>
                {formatShortDate(new Date(selectedStartDate))} -{" "}
                {formatShortDate(new Date(selectedEndDate))}
              </Text>
              <TouchableOpacity onPress={handleClearRange}>
                <Ionicons name="close-circle" size={18} color="#C62828" />
              </TouchableOpacity>
            </View>
          )}
      </View>

      {/* Sort Button */}
      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() =>
            setSortOrder((prev) => (prev === "DESC" ? "ASC" : "DESC"))
          }
        >
          <Text style={styles.sortButtonText}>
            {sortOrder === "DESC" ? "Terbaru" : "Terlama"}
          </Text>
          <Ionicons
            name={sortOrder === "DESC" ? "arrow-down" : "arrow-up"}
            size={14}
            color="#D4A373"
          />
        </TouchableOpacity>
      </View>

      {/* Transaction Count */}
      <View style={styles.countContainer}>
        <Text style={styles.countText}>
          {transactions.length} transaksi ditemukan
        </Text>
      </View>

      {/* Timeline List */}
      <FlatList
        key={isTablet ? "tablet-col" : "mobile-col"}
        numColumns={isTablet ? 2 : 1}
        columnWrapperStyle={isTablet ? styles.rowGrid : undefined}
        data={transactions}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTransaction}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="swap-horizontal-outline"
              size={60}
              color="#DDD7CE"
            />
            <Text style={styles.emptyText}>Belum ada transaksi mutasi</Text>
          </View>
        }
      />

      {/* CALENDAR MODAL FOR RANGE PICKER */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCalendar}
        onRequestClose={() => setShowCalendar(false)}
      >
        <View style={styles.calendarModalOverlay}>
          <View style={styles.calendarModalContent}>
            <View style={styles.calendarModalHeader}>
              <Text style={styles.calendarModalTitle}>
                {calendarMode === "start"
                  ? "Pilih Tanggal Mulai"
                  : "Pilih Tanggal Selesai"}
              </Text>
              <TouchableOpacity onPress={() => setShowCalendar(false)}>
                <Ionicons name="close" size={24} color="#5C2C06" />
              </TouchableOpacity>
            </View>

            <Calendar
              current={
                calendarMode === "start"
                  ? undefined
                  : selectedStartDate || undefined
              }
              markingType={"period"}
              markedDates={markedDates}
              onDayPress={handleCalendarDayPress}
              theme={{
                backgroundColor: "#FDF8F5",
                calendarBackground: "#FDF8F5",
                textSectionTitleColor: "#5C2C06",
                selectedDayBackgroundColor: "#5C2C06",
                selectedDayTextColor: "#FFFFFF",
                todayTextColor: "#D4A373",
                dayTextColor: "#2C1A0E",
                textDisabledColor: "#DDD7CE",
                dotColor: "#D4A373",
                selectedDotColor: "#FFFFFF",
                arrowColor: "#D4A373",
                monthTextColor: "#5C2C06",
                textDayFontFamily: "Inter",
                textMonthFontFamily: "Outfit",
                textDayHeaderFontFamily: "Outfit",
                textDayFontSize: 14,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 12,
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal Input Mutasi */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Input Mutasi Stok</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#5C2C06" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.formContainer}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    type === "IN" && styles.typeBtnActiveIn,
                  ]}
                  onPress={() => setType("IN")}
                >
                  <Ionicons
                    name="arrow-down"
                    size={18}
                    color={type === "IN" ? "#FDF8F5" : "#2E7D32"}
                  />
                  <Text
                    style={[
                      styles.typeBtnText,
                      type === "IN" && styles.typeBtnTextActive,
                    ]}
                  >
                    Stok Masuk
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeBtn,
                    type === "OUT" && styles.typeBtnActiveOut,
                  ]}
                  onPress={() => setType("OUT")}
                >
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color={type === "OUT" ? "#FDF8F5" : "#C62828"}
                  />
                  <Text
                    style={[
                      styles.typeBtnText,
                      type === "OUT" && styles.typeBtnTextActive,
                    ]}
                  >
                    Stok Keluar
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tanggal dan Jam Transaksi */}
              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeItem}>
                  <Text style={styles.label}>Tanggal Transaksi</Text>
                  <TouchableOpacity
                    style={styles.dateInputBtn}
                    onPress={() => setShowTransactionCalendar(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color="#D4A373"
                    />
                    <Text style={styles.dateInputText}>
                      {formatShortDate(selectedDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.dateTimeItem}>
                  <Text style={styles.label}>Jam Transaksi</Text>
                  <TouchableOpacity
                    style={styles.dateInputBtn}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={16} color="#D4A373" />
                    <Text style={styles.dateInputText}>
                      {formatTime(selectedDate)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>Pilih Barang *</Text>
              <TouchableOpacity
                style={styles.selectItemBtn}
                onPress={handleOpenSelectModal}
              >
                {selectedItem ? (
                  <View>
                    <Text style={styles.selectedItemName}>
                      {selectedItem.name}
                    </Text>
                    <Text style={styles.selectedItemStock}>
                      Stok saat ini: {selectedItem.stock} {selectedItem.unit}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.selectItemPlaceholder}>
                    -- Ketuk untuk mencari barang --
                  </Text>
                )}
                <Ionicons name="search-outline" size={20} color="#D4A373" />
              </TouchableOpacity>

              <Text style={styles.label}>
                Jumlah ({selectedItem?.unit || "-"}) *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
                placeholderTextColor="#B0A090"
              />

              <Text style={styles.label}>Catatan Tambahan</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={
                  type === "IN"
                    ? "Contoh: Beli dari supplier baru"
                    : "Contoh: Stok kadaluarsa"
                }
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholderTextColor="#B0A090"
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Simpan Mutasi</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Calendar Modal untuk Input Tanggal Transaksi */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={showTransactionCalendar}
            onRequestClose={() => setShowTransactionCalendar(false)}
          >
            <View style={styles.calendarModalOverlay}>
              <View style={styles.calendarModalContent}>
                <View style={styles.calendarModalHeader}>
                  <Text style={styles.calendarModalTitle}>
                    Pilih Tanggal Transaksi
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowTransactionCalendar(false)}
                  >
                    <Ionicons name="close" size={24} color="#5C2C06" />
                  </TouchableOpacity>
                </View>

                <Calendar
                  current={selectedDate.toISOString().split("T")[0]}
                  markedDates={{
                    [selectedDate.toISOString().split("T")[0]]: {
                      selected: true,
                      selectedColor: "#5C2C06",
                      selectedTextColor: "#FFFFFF",
                    },
                  }}
                  onDayPress={handleTransactionDateSelect}
                  theme={{
                    backgroundColor: "#FDF8F5",
                    calendarBackground: "#FDF8F5",
                    textSectionTitleColor: "#5C2C06",
                    selectedDayBackgroundColor: "#5C2C06",
                    selectedDayTextColor: "#FFFFFF",
                    todayTextColor: "#D4A373",
                    dayTextColor: "#2C1A0E",
                    textDisabledColor: "#DDD7CE",
                    arrowColor: "#D4A373",
                    monthTextColor: "#5C2C06",
                    textDayFontFamily: "Inter",
                    textMonthFontFamily: "Outfit",
                    textDayHeaderFontFamily: "Outfit",
                    textDayFontSize: 14,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 12,
                  }}
                />
              </View>
            </View>
          </Modal>

          {/* Time Picker untuk Jam Transaksi */}
          {showTimePicker && Platform.OS === "ios" && (
            <Modal
              transparent={true}
              visible={showTimePicker}
              animationType="fade"
              onRequestClose={() => setShowTimePicker(false)}
            >
              <View style={styles.timePickerOverlay}>
                <View style={styles.timePickerContainer}>
                  <View style={styles.timePickerHeader}>
                    <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.timePickerCancelText}>Batal</Text>
                    </TouchableOpacity>
                    <Text style={styles.timePickerTitle}>Pilih Jam</Text>
                    <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.timePickerDoneText}>OK</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={selectedDate}
                    mode="time"
                    display="spinner"
                    onChange={handleTimeChange}
                    style={styles.timePickerSpinner}
                  />
                </View>
              </View>
            </Modal>
          )}

          {showTimePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={selectedDate}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          )}

          {itemModalVisible && (
            <View style={styles.itemModalOverlay}>
              <View style={styles.itemModalContent}>
                <View style={styles.itemModalHeader}>
                  <Text style={styles.itemModalTitle}>Cari Barang</Text>
                  <TouchableOpacity onPress={() => setItemModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#5C2C06" />
                  </TouchableOpacity>
                </View>

                <View style={styles.itemSearchContainer}>
                  <Ionicons name="search" size={20} color="#8C7B6E" />
                  <TextInput
                    style={styles.itemSearchInput}
                    placeholder="Ketik nama barang..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#B0A090"
                  />
                </View>

                <FlatList
                  data={filteredItemsForSelect}
                  keyExtractor={(item) => item.id.toString()}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.itemListItem}
                      onPress={() => {
                        setSelectedItem(item);
                        setItemModalVisible(false);
                      }}
                    >
                      <Text style={styles.itemListName}>{item.name}</Text>
                      <Text style={styles.itemListStock}>
                        Stok: {item.stock} {item.unit}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.itemListEmpty}>
                      Barang tidak ditemukan.
                    </Text>
                  }
                />
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F2" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 12,
    backgroundColor: "#FAF7F2",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "Outfit",
    color: "#5C2C06",
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter",
    color: "#8C7B6E",
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    backgroundColor: "#5C2C06",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#5C2C06",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonText: {
    color: "#FDF8F5",
    fontWeight: "600",
    fontFamily: "Outfit",
    marginLeft: 6,
    fontSize: 14,
  },

  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontFamily: "Outfit",
    fontWeight: "600",
    color: "#5C2C06",
    marginBottom: 10,
  },
  filterChipsContainer: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#FDF8F5",
    shadowColor: "#5C2C06",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: "#D4A373",
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Outfit",
    fontWeight: "500",
    color: "#8C7B6E",
  },
  filterChipTextActive: {
    color: "#FDF8F5",
    fontWeight: "600",
  },
  activeRangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EDE8E2",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  activeRangeText: {
    fontSize: 12,
    fontFamily: "Inter",
    color: "#5C2C06",
    flex: 1,
  },

  sortContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FDF8F5",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: "#5C2C06",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  sortButtonText: {
    fontSize: 12,
    fontFamily: "Outfit",
    fontWeight: "600",
    color: "#D4A373",
  },

  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter",
    color: "#8C7B6E",
  },

  listContainer: { padding: 16, paddingBottom: 80 },
  rowGrid: { justifyContent: "space-between" },

  timelineItem: {
    position: "relative",
    marginBottom: 20,
    paddingLeft: 24,
  },
  timelineDot: {
    position: "absolute",
    left: 8,
    top: 18,
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  timelineLine: {
    position: "absolute",
    left: 13,
    top: 30,
    bottom: -20,
    width: 2,
    backgroundColor: "rgba(212,163,115,0.3)",
  },

  card: {
    backgroundColor: "#FDF8F5",
    borderRadius: 16,
    padding: 14,
    marginLeft: 4,
    shadowColor: "#5C2C06",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTablet: { width: "95%" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Outfit",
    color: "#2C1A0E",
    flex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  cardBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  qtyText: {
    fontWeight: "800",
    fontFamily: "Outfit",
    fontSize: 16,
  },
  dateText: {
    fontSize: 10,
    fontFamily: "Inter",
    color: "#8C7B6E",
  },
  noteText: {
    fontSize: 10,
    fontFamily: "Inter",
    color: "#B0A090",
    marginTop: 8,
    fontStyle: "italic",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyText: {
    color: "#B0A090",
    marginTop: 12,
    fontSize: 14,
    fontFamily: "Inter",
  },

  calendarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(45,25,10,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  calendarModalContent: {
    backgroundColor: "#FDF8F5",
    width: "90%",
    borderRadius: 24,
    overflow: "hidden",
  },
  calendarModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(92,44,6,0.08)",
  },
  calendarModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Outfit",
    color: "#5C2C06",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(45,25,10,0.6)",
    justifyContent: "flex-end",
    zIndex: 1,
  },
  modalContent: {
    backgroundColor: "#FDF8F5",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(92,44,6,0.08)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Outfit",
    color: "#5C2C06",
  },
  formContainer: { padding: 20, paddingBottom: 40 },

  typeSelector: {
    flexDirection: "row",
    marginBottom: 24,
    backgroundColor: "#EDE8E2",
    borderRadius: 16,
    padding: 4,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  typeBtnActiveIn: { backgroundColor: "#2E7D32" },
  typeBtnActiveOut: { backgroundColor: "#C62828" },
  typeBtnText: {
    fontWeight: "600",
    fontFamily: "Outfit",
    fontSize: 13,
    color: "#8C7B6E",
  },
  typeBtnTextActive: { color: "#FDF8F5" },

  dateTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  dateTimeItem: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: "Outfit",
    fontWeight: "600",
    color: "#8C7B6E",
    marginBottom: 8,
  },
  dateInputBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE8E2",
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  dateInputText: {
    fontSize: 14,
    fontFamily: "Inter",
    color: "#2C1A0E",
  },

  selectItemBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE8E2",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedItemName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Outfit",
    color: "#2C1A0E",
  },
  selectedItemStock: {
    fontSize: 11,
    fontFamily: "Inter",
    color: "#8C7B6E",
    marginTop: 2,
  },
  selectItemPlaceholder: {
    fontSize: 14,
    fontFamily: "Inter",
    color: "#B0A090",
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE8E2",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter",
    color: "#2C1A0E",
    marginBottom: 16,
  },
  textArea: { height: 80, textAlignVertical: "top" },

  saveButton: {
    backgroundColor: "#5C2C06",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#5C2C06",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonText: {
    color: "#FDF8F5",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Outfit",
  },

  timePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  timePickerContainer: {
    backgroundColor: "#FDF8F5",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  timePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(92,44,6,0.08)",
  },
  timePickerTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Outfit",
    color: "#5C2C06",
  },
  timePickerCancelText: {
    color: "#8C7B6E",
    fontFamily: "Outfit",
    fontSize: 14,
  },
  timePickerDoneText: {
    color: "#D4A373",
    fontFamily: "Outfit",
    fontWeight: "600",
    fontSize: 14,
  },
  timePickerSpinner: {
    height: 200,
  },

  itemModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(45,25,10,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  itemModalContent: {
    backgroundColor: "#FDF8F5",
    width: "90%",
    height: "70%",
    borderRadius: 24,
    padding: 20,
  },
  itemModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  itemModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Outfit",
    color: "#5C2C06",
  },
  itemSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDE8E2",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 15,
    gap: 10,
  },
  itemSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter",
    color: "#2C1A0E",
  },
  itemListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(92,44,6,0.06)",
  },
  itemListName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Outfit",
    color: "#2C1A0E",
  },
  itemListStock: {
    fontSize: 12,
    fontFamily: "Inter",
    color: "#8C7B6E",
  },
  itemListEmpty: {
    textAlign: "center",
    marginTop: 20,
    color: "#B0A090",
    fontFamily: "Inter",
  },
});
