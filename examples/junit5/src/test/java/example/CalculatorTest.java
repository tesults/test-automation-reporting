package example;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class CalculatorTest {
    @Test
    void addsTwoNumbers() {
        assertEquals(5, 2 + 3);
    }

    @Test
    void subtractsTwoNumbers() {
        assertEquals(3, 7 - 4);
    }
}
